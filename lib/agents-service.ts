import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import type { AgentRow } from '@/lib/api-types'

export async function listAgents(): Promise<AgentRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anthropicAgents: any[]
  const result = await beta.agents.list()
  anthropicAgents = (result.data ?? []) as any[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kobaniAgents = anthropicAgents.filter((a: any) =>
    typeof a.name === 'string' && a.name.startsWith('kobani-'),
  )

  const dbRows = await prisma.agentConfig.findMany()
  const dbMap = new Map(dbRows.map((row) => [row.anthropicAgentId, row]))

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

  const anthropicIds = new Set(kobaniAgents.map((a: any) => a.id))
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
