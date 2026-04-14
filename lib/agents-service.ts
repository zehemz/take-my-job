import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import type { AgentRow } from '@/lib/api-types'

export async function listAgents(): Promise<AgentRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anthropicAgents: any[] = []
  for await (const agent of beta.agents.list()) {
    anthropicAgents.push(agent)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kobaniAgents = anthropicAgents.filter((a: any) =>
    typeof a.name === 'string' && a.name.startsWith('kobani-') && a.archived_at == null,
  )

  const dbRows = await prisma.agentConfig.findMany()
  const dbMap = new Map(dbRows.map((row) => [row.anthropicAgentId, row]))
  const anthropicIds = new Set(kobaniAgents.map((a: any) => a.id))

  // Auto-heal orphaned DB records: if the agent was recreated on Anthropic
  // with a new ID, match by role name (kobani-<role>) and update the DB pointer.
  const dbByRole = new Map(dbRows.map((row) => [row.role, row]))
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
    dbMap.delete(dbRecord.anthropicAgentId)
    dbRecord.anthropicAgentId = agent.id
    dbRecord.anthropicAgentVersion = String(agent.version ?? '')
    dbMap.set(agent.id, dbRecord)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  for (const dbRecord of dbRows) {
    if (!anthropicIds.has(dbRecord.anthropicAgentId)) {
      rows.push({
        anthropicAgentId: dbRecord.anthropicAgentId,
        name: dbRecord.role,
        model: '',
        anthropicVersion: dbRecord.anthropicAgentVersion,
        role: dbRecord.role,
        dbId: dbRecord.id,
        syncStatus: 'orphaned',
      })
    }
  }

  return rows
}
