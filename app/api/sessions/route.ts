import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'
import type { SessionRow, SessionStatus } from '@/lib/api-types'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  const agentRuns = await prisma.agentRun.findMany({
    where: { sessionId: { not: null } },
    include: { card: { select: { id: true, boardId: true } } },
  })

  const runBySessionId = new Map(
    agentRuns.map((run) => [run.sessionId as string, run]),
  )

  const sessions: SessionRow[] = []
  try {
    for await (const s of beta.sessions.list()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = s as any
      const run = runBySessionId.get(raw.id)
      sessions.push({
        id: raw.id,
        title: raw.title ?? null,
        status: raw.status as SessionStatus,
        agentName: raw.agent?.name ?? '',
        agentId: raw.agent?.id ?? '',
        environmentId: raw.environment_id ?? '',
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        cardId: run?.cardId ?? null,
        boardId: run?.card?.boardId ?? null,
        agentRole: run?.role ?? null,
        agentRunStatus: run?.status ?? null,
      })
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch sessions from Anthropic', details: message },
      { status: 502 },
    )
  }

  sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return NextResponse.json(sessions)
}
