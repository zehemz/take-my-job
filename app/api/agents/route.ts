import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mapAgentConfig } from '@/lib/api-mappers'
import { devAuth as auth } from '@/lib/dev-auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agents = await prisma.agentConfig.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(agents.map(mapAgentConfig))
}
