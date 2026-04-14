import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'
import type { AgentDetail } from '@/lib/api-types'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  let agent: any
  try {
    agent = await beta.agents.retrieve(id)
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode
    if (status === 404) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch agent from Anthropic', details: e.message },
      { status: 502 },
    )
  }

  const dbRecord = await prisma.agentConfig.findFirst({
    where: { anthropicAgentId: id },
  })

  const detail: AgentDetail = {
    anthropicAgentId: agent.id,
    name: agent.name,
    model: typeof agent.model === 'object' ? (agent.model?.id ?? '') : (agent.model ?? ''),
    anthropicVersion: String(agent.version ?? ''),
    role: dbRecord?.role ?? null,
    dbId: dbRecord?.id ?? null,
    syncStatus: dbRecord ? 'healthy' : (agent.archived_at ? 'orphaned' : 'unmapped'),
    description: agent.description ?? null,
    createdAt: agent.created_at ?? new Date().toISOString(),
    archivedAt: agent.archived_at ?? null,
  }

  return NextResponse.json(detail)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  let anthropicError: string | null = null
  try {
    await beta.agents.archive(id)
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode
    if (status !== 404) {
      anthropicError = e.message
    }
    // 404 → already gone; proceed to DB cleanup
  }

  // Always clean up the DB record regardless of Anthropic outcome
  await prisma.agentConfig.deleteMany({ where: { anthropicAgentId: id } })

  if (anthropicError) {
    return NextResponse.json(
      { error: 'Agent removed from DB but Anthropic deletion failed', details: anthropicError },
      { status: 502 },
    )
  }

  return new NextResponse(null, { status: 204 })
}
