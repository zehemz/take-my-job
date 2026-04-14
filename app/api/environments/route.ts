import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { devAuth as auth } from '@/lib/dev-auth'
import type { EnvironmentRow } from '@/lib/api-types'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  try {
    const items: EnvironmentRow[] = []
    for await (const env of beta.environments.list()) {
      if (env.archived_at !== null) continue
      items.push({
        id: env.id,
        name: env.name,
        description: env.description ?? '',
        createdAt: env.created_at,
        updatedAt: env.updated_at,
        networkType: env.config?.networking?.type ?? 'unrestricted',
      })
    }
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to fetch environments from Anthropic', details: e.message },
      { status: 502 },
    )
  }
}
