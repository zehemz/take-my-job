import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'
import type { AgentDetail, PatchAgentRequest, PatchAgentResponse } from '@/lib/api-types'

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
    system: agent.system ?? null,
    createdAt: agent.created_at ?? new Date().toISOString(),
    archivedAt: agent.archived_at ?? null,
  }

  return NextResponse.json(detail)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const body = await req.json() as PatchAgentRequest

  if (typeof body.version !== 'number') {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // Separate Anthropic fields from Kobani fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anthropicFields: Record<string, any> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 256) {
      return NextResponse.json({ error: 'name must be 1-256 characters' }, { status: 400 })
    }
    anthropicFields.name = body.name
  }
  if (body.description !== undefined) {
    anthropicFields.description = body.description === '' ? null : body.description
  }
  if (body.model !== undefined) {
    anthropicFields.model = body.model
  }
  if (body.system !== undefined) {
    anthropicFields.system = body.system === '' ? null : body.system
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updatedAgent: any

  // Update Anthropic if any fields changed
  if (Object.keys(anthropicFields).length > 0) {
    try {
      updatedAgent = await beta.agents.update(id, {
        ...anthropicFields,
        version: body.version,
      })
    } catch (e: any) {
      const status = e?.status ?? e?.statusCode
      if (status === 404) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
      if (status === 409) {
        return NextResponse.json({
          error: 'version_conflict',
          currentVersion: e?.body?.version ?? null,
          submittedVersion: body.version,
        }, { status: 409 })
      }
      return NextResponse.json(
        { error: 'Failed to update agent', details: e.message },
        { status: 502 },
      )
    }
  } else {
    // No Anthropic fields — still need to fetch current state
    try {
      updatedAgent = await beta.agents.retrieve(id)
    } catch (e: any) {
      const status = e?.status ?? e?.statusCode
      if (status === 404) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Failed to fetch agent', details: e.message },
        { status: 502 },
      )
    }
  }

  // Update Kobani role if provided
  let dbRecord = await prisma.agentConfig.findFirst({
    where: { anthropicAgentId: id },
  })

  if (body.role !== undefined) {
    // Check uniqueness — another agent with this role?
    const existing = await prisma.agentConfig.findFirst({
      where: { role: body.role, NOT: { anthropicAgentId: id } },
    })
    if (existing) {
      return NextResponse.json({
        error: 'role_conflict',
        message: `Role "${body.role}" is already assigned to another agent`,
      }, { status: 409 })
    }

    if (dbRecord) {
      dbRecord = await prisma.agentConfig.update({
        where: { id: dbRecord.id },
        data: { role: body.role },
      })
    } else {
      // Upsert — create AgentConfig for unmapped agents
      dbRecord = await prisma.agentConfig.create({
        data: {
          role: body.role,
          anthropicAgentId: id,
          anthropicAgentVersion: String(updatedAgent.version ?? ''),
          anthropicEnvironmentId: '',
        },
      })
    }
  }

  const detail: AgentDetail = {
    anthropicAgentId: updatedAgent.id,
    name: updatedAgent.name,
    model: typeof updatedAgent.model === 'object' ? (updatedAgent.model?.id ?? '') : (updatedAgent.model ?? ''),
    anthropicVersion: String(updatedAgent.version ?? ''),
    role: dbRecord?.role ?? null,
    dbId: dbRecord?.id ?? null,
    syncStatus: dbRecord ? 'healthy' : 'unmapped',
    description: updatedAgent.description ?? null,
    system: updatedAgent.system ?? null,
    createdAt: updatedAgent.created_at ?? new Date().toISOString(),
    archivedAt: updatedAgent.archived_at ?? null,
  }

  return NextResponse.json({
    agent: detail,
    newVersion: updatedAgent.version,
  } satisfies PatchAgentResponse)
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
