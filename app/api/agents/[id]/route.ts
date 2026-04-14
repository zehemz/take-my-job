import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { devAuth as auth } from '@/lib/dev-auth'

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
    await beta.agents.delete(id)
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
