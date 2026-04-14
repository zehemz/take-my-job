import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export interface CardDraft {
  title: string;
  role: string;
  description: string;
  acceptanceCriteria: string[];
}

function buildSystemPrompt(roles: string[]) {
  return `You are a project manager breaking down a product spec into discrete agent tasks.

Each task will be executed autonomously by an AI agent with a specific role. Output a JSON array of task cards.

Rules:
- Each card must have a clear, actionable title (max 80 chars)
- Choose the most appropriate role from: ${roles.join(', ')}
- You MUST only use roles from the list above. Do not invent new roles.
- Description should explain what the agent needs to do (2-4 sentences)
- acceptanceCriteria: 2-5 specific, testable criteria (each one line, no bullet prefix)
- Decompose the spec into logical units of work — not too coarse (one card per feature area), not too granular (no card per function)
- Order cards so dependencies come first
- Output ONLY valid JSON, no markdown fences, no commentary`;
}

const USER_PROMPT = (spec: string) =>
  `Break this spec into agent task cards:\n\n${spec}`;

export async function POST(req: NextRequest) {
  let spec: string;
  try {
    const body = await req.json();
    spec = body.spec?.trim();
    if (!spec) return NextResponse.json({ error: 'spec is required' }, { status: 400 });
    if (spec.length > 20000) return NextResponse.json({ error: 'spec too long (max 20000 chars)' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  // Fetch available roles from AgentConfig
  const configs = await prisma.agentConfig.findMany({ select: { role: true }, orderBy: { role: 'asc' } });
  const availableRoles = configs.map((c) => c.role);
  if (availableRoles.length === 0) {
    return NextResponse.json({ error: 'No agent roles configured. Run setup-agents first.' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(availableRoles),
      messages: [{ role: 'user', content: USER_PROMPT(spec) }],
    });
    const block = message.content.find((b) => b.type === 'text');
    raw = block?.type === 'text' ? block.text.trim() : '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 502 });
  }

  let cards: CardDraft[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('expected array');
    cards = parsed.map((item, i) => {
      if (typeof item.title !== 'string') throw new Error(`card ${i}: missing title`);
      const role = availableRoles.includes(item.role) ? item.role : availableRoles[0];
      return {
        title: String(item.title).slice(0, 80),
        role,
        description: typeof item.description === 'string' ? item.description : '',
        acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
          ? item.acceptanceCriteria.map(String)
          : [],
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse Claude response: ${msg}`, raw }, { status: 502 });
  }

  return NextResponse.json({ cards });
}
