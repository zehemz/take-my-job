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

  try {
    await beta.agents.delete(id)
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode
    if (status !== 404) {
      return NextResponse.json(
        { error: 'Failed to delete agent from Anthropic', details: e.message },
        { status: 502 },
      )
    }
    // 404 → agent already gone; still clean up the DB record below
  }

  await prisma.agentConfig.deleteMany({ where: { anthropicAgentId: id } })

  return new NextResponse(null, { status: 204 })
}
