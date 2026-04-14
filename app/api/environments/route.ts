import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { devAuth as auth } from '@/lib/dev-auth'
import type { EnvironmentRow, PaginatedResponse } from '@/lib/api-types'

const DEFAULT_LIMIT = 20

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 100)
  const page = url.searchParams.get('page') || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  try {
    const result = await beta.environments.list({ limit, ...(page ? { page } : {}) })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result.data ?? []) as any[]
    const nextPage: string | null = result.next_page ?? null

    const items: EnvironmentRow[] = data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((env: any) => env.archived_at === null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((env: any) => ({
        id: env.id,
        name: env.name,
        description: env.description ?? '',
        createdAt: env.created_at,
        updatedAt: env.updated_at,
        networkType: env.config?.networking?.type ?? 'unrestricted',
      }))

    const response: PaginatedResponse<EnvironmentRow> = { items, nextPage }
    return NextResponse.json(response)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch environments from Anthropic', details: message },
      { status: 502 },
    )
  }
}
