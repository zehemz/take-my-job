import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';

export async function GET() {
  const configs = await prisma.agentConfig.findMany({
    select: { role: true, anthropicAgentId: true },
    orderBy: { role: 'asc' },
  });

  // Cross-reference with Anthropic to exclude orphaned configs
  // (DB record exists but the agent has been deleted from Anthropic)
  let liveAgentIds: Set<string>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beta = (new Anthropic()).beta as any;
    const agentList: any[] = [];
    for await (const agent of beta.agents.list()) {
      agentList.push(agent);
    }
    liveAgentIds = new Set(agentList.map((a: any) => a.id));
  } catch {
    // If Anthropic API is unreachable, return all DB roles as fallback
    const roles = configs.map((c) => c.role);
    return NextResponse.json({ roles });
  }

  const roles = configs
    .filter((c) => liveAgentIds.has(c.anthropicAgentId))
    .map((c) => c.role);

  return NextResponse.json({ roles });
}
