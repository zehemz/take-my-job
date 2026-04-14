import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'
import type { AgentRow } from '@/lib/api-types'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The managed agents API is available at runtime but not yet typed in SDK 0.52.x
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  let anthropicAgents: any[]
  try {
    const anthropicList: any[] = []
    for await (const agent of beta.agents.list()) {
      anthropicList.push(agent)
    }
    anthropicAgents = anthropicList
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to fetch agents from Anthropic', details: e.message },
      { status: 502 },
    )
  }

  // Only show agents that belong to this project
  const kobaniAgents = anthropicAgents.filter((a: any) =>
    typeof a.name === 'string' && a.name.startsWith('kobani-') && a.archived_at == null,
  )

  const dbRows = await prisma.agentConfig.findMany()
  const dbMap = new Map(dbRows.map((row) => [row.anthropicAgentId, row]))
  const anthropicIds = new Set(kobaniAgents.map((a: any) => a.id))

  // Auto-heal orphaned DB records: if the agent was recreated on Anthropic
  // with a new ID, match by role name (kobani-<role>) and update the DB pointer.
  const dbByRole = new Map(dbRows.map((row) => [row.role, row]))
  // Build a map of role → latest Anthropic agent (prefer the one with highest ID for determinism)
  const latestByRole = new Map<string, any>()
  for (const a of kobaniAgents) {
    const role = (a.name as string).replace(/^kobani-/, '')
    if (!dbMap.has(a.id) && dbByRole.has(role)) {
      const existing = latestByRole.get(role)
      if (!existing || a.id > existing.id) {
        latestByRole.set(role, a)
      }
    }
  }
  for (const [role, agent] of latestByRole) {
    const dbRecord = dbByRole.get(role)!
    await prisma.agentConfig.update({
      where: { id: dbRecord.id },
      data: {
        anthropicAgentId: agent.id,
        anthropicAgentVersion: String(agent.version ?? ''),
      },
    })
    // Update in-memory maps so the rest of the logic sees the fix
    dbMap.delete(dbRecord.anthropicAgentId)
    dbRecord.anthropicAgentId = agent.id
    dbRecord.anthropicAgentVersion = String(agent.version ?? '')
    dbMap.set(agent.id, dbRecord)
  }

  const rows: AgentRow[] = kobaniAgents.map((a: any): AgentRow => {
    const dbRecord = dbMap.get(a.id)
    return dbRecord
      ? {
          anthropicAgentId: a.id,
          name: a.name,
          model: typeof a.model === 'object' ? (a.model?.id ?? '') : (a.model ?? ''),
          anthropicVersion: String(a.version ?? ''),
          role: dbRecord.role,
          dbId: dbRecord.id,
          syncStatus: 'healthy',
        }
      : {
          anthropicAgentId: a.id,
          name: a.name,
          model: typeof a.model === 'object' ? (a.model?.id ?? '') : (a.model ?? ''),
          anthropicVersion: String(a.version ?? ''),
          role: null,
          dbId: null,
          syncStatus: 'unmapped',
        }
  })

  // Clean up orphaned DB records (DB has agentId not returned by Anthropic).
  // These are agents that were deleted from Anthropic but still have a DB config.
  // Removing them keeps the /api/roles dropdown in sync.
  const orphanedIds: string[] = [];
  for (const dbRecord of dbRows) {
    if (!anthropicIds.has(dbRecord.anthropicAgentId)) {
      orphanedIds.push(dbRecord.id);
    }
  }
  if (orphanedIds.length > 0) {
    await prisma.agentConfig.deleteMany({ where: { id: { in: orphanedIds } } });
  }

  return NextResponse.json(rows)
}
