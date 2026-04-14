import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { AgentRole } from '@/lib/kanban-types';

const AGENT_ROLES: AgentRole[] = [
  'backend-engineer',
  'qa-engineer',
  'tech-lead',
  'content-writer',
  'product-spec-writer',
  'designer',
];

export interface CardDraft {
  title: string;
  role: AgentRole;
  description: string;
  acceptanceCriteria: string[];
}

const SYSTEM_PROMPT = `You are a project manager breaking down a product spec into discrete agent tasks.

Each task will be executed autonomously by an AI agent with a specific role. Output a JSON array of task cards.

Rules:
- Each card must have a clear, actionable title (max 80 chars)
- Choose the most appropriate role from: ${AGENT_ROLES.join(', ')}
- Description should explain what the agent needs to do (2-4 sentences)
- acceptanceCriteria: 2-5 specific, testable criteria (each one line, no bullet prefix)
- Decompose the spec into logical units of work — not too coarse (one card per feature area), not too granular (no card per function)
- Order cards so dependencies come first
- Output ONLY valid JSON, no markdown fences, no commentary`;

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

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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
      const role: AgentRole = AGENT_ROLES.includes(item.role) ? item.role : 'backend-engineer';
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
