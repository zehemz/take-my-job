import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'
import type { SessionRow, SessionStatus, PaginatedResponse } from '@/lib/api-types'

const DEFAULT_LIMIT = 20

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 100)
  const page = url.searchParams.get('page') || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  const agentRuns = await prisma.agentRun.findMany({
    where: { sessionId: { not: null } },
    include: { card: { select: { id: true, boardId: true } } },
  })

  const runBySessionId = new Map(
    agentRuns.map((run) => [run.sessionId as string, run]),
  )

  try {
    const result = await beta.sessions.list({ limit, ...(page ? { page } : {}) })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result.data ?? []) as any[]
    const nextPage: string | null = result.next_page ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: SessionRow[] = data.map((raw: any) => {
      const run = runBySessionId.get(raw.id)
      return {
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
      }
    })

    const response: PaginatedResponse<SessionRow> = { items, nextPage }
    return NextResponse.json(response)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch sessions from Anthropic', details: message },
      { status: 502 },
    )
  }
}
