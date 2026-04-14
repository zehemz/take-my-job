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
    const result = await beta.agents.list()
    anthropicAgents = (result.data ?? []) as any[]
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to fetch agents from Anthropic', details: e.message },
      { status: 502 },
    )
  }

  // Only show agents that belong to this project
  const kobaniAgents = anthropicAgents.filter((a: any) =>
    typeof a.name === 'string' && a.name.startsWith('kobani-'),
  )

  const dbRows = await prisma.agentConfig.findMany()
  const dbMap = new Map(dbRows.map((row) => [row.anthropicAgentId, row]))

  const rows: AgentRow[] = kobaniAgents.map((a: any): AgentRow => {
    const dbRecord = dbMap.get(a.id)
    return dbRecord
      ? {
          anthropicAgentId: a.id,
          name: a.name,
          model: typeof a.model === 'object' ? (a.model?.id ?? '') : (a.model ?? ''),
          anthropicVersion: String(a.version ?? ''),
          environmentId: a.environment_id ?? null,
          role: dbRecord.role,
          dbId: dbRecord.id,
          syncStatus: 'healthy',
        }
      : {
          anthropicAgentId: a.id,
          name: a.name,
          model: typeof a.model === 'object' ? (a.model?.id ?? '') : (a.model ?? ''),
          anthropicVersion: String(a.version ?? ''),
          environmentId: a.environment_id ?? null,
          role: null,
          dbId: null,
          syncStatus: 'unmapped',
        }
  })

  // Add orphaned DB records (DB has agentId not returned by Anthropic)
  const anthropicIds = new Set(kobaniAgents.map((a: any) => a.id))
  for (const dbRecord of dbRows) {
    if (!anthropicIds.has(dbRecord.anthropicAgentId)) {
      rows.push({
        anthropicAgentId: dbRecord.anthropicAgentId,
        name: dbRecord.role,
        model: '',
        anthropicVersion: dbRecord.anthropicAgentVersion,
        environmentId: null,
        role: dbRecord.role,
        dbId: dbRecord.id,
        syncStatus: 'orphaned',
      })
    }
  }

  return NextResponse.json(rows)
}
