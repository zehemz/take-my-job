import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export interface CardDraft {
  title: string;
  role: string;
  description: string;
  acceptanceCriteria: string[];
  /** Zero-based indices of cards this one depends on. */
  dependsOnIndices: number[];
  /** Anthropic environment ID best suited for this task. */
  environmentId: string | null;
}

interface EnvInfo {
  id: string;
  name: string;
  description: string;
  packages: string[];
}

function buildSystemPrompt(roles: string[], envs: EnvInfo[]) {
  const envBlock = envs.length > 0
    ? `\nAvailable environments (each has pre-installed packages):\n${envs.map((e) => `- "${e.id}" (${e.name}): ${e.description || 'no description'}. Packages: ${e.packages.join(', ') || 'none'}`).join('\n')}\n\nFor each card, set "environmentId" to the ID of the environment best suited for that task based on the packages it needs. If no environment is a good fit, set "environmentId" to null.`
    : '\nNo environments are configured. Set "environmentId" to null for every card.';

  return `You are a project manager breaking down a product spec into discrete agent tasks.

Each task will be executed autonomously by an AI agent with a specific role. Output a JSON array of task cards.

Rules:
- Each card must have a clear, actionable title (max 80 chars)
- Choose the most appropriate role from: ${roles.join(', ')}
- You MUST only use roles from the list above. Do not invent new roles.
- Description should explain what the agent needs to do (2-4 sentences)
- acceptanceCriteria: 2-5 specific, testable criteria (each one line, no bullet prefix)
- dependsOnIndices: array of zero-based indices of other cards that must complete before this one can start. Use [] if the card has no dependencies. Example: if card 2 depends on cards 0 and 1, set "dependsOnIndices": [0, 1]
- environmentId: pick the best environment for the task (see below)
- Decompose the spec into logical units of work — not too coarse (one card per feature area), not too granular (no card per function)
- Order cards so dependencies come first
- Output ONLY valid JSON, no markdown fences, no commentary
${envBlock}`;
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

  // Fetch available environments from Anthropic
  const client = new Anthropic({ apiKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (client as any).beta as any;
  let envInfos: EnvInfo[] = [];
  try {
    const envResult = await beta.environments.list({ limit: 100 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    envInfos = ((envResult.data ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => !e.archived_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => {
        const pkgs = e.config?.packages ?? {};
        const allPkgs = [
          ...(pkgs.apt ?? []),
          ...(pkgs.npm ?? []),
          ...(pkgs.pip ?? []),
          ...(pkgs.cargo ?? []),
          ...(pkgs.gem ?? []),
          ...(pkgs.go ?? []),
        ];
        return {
          id: e.id,
          name: e.name,
          description: e.description ?? '',
          packages: allPkgs,
        };
      });
  } catch {
    // Non-fatal — proceed without environment info
  }

  // Build valid environment IDs set for validation
  const validEnvIds = new Set(envInfos.map((e) => e.id));

  let raw: string;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(availableRoles, envInfos),
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
      const envId = typeof item.environmentId === 'string' && validEnvIds.has(item.environmentId)
        ? item.environmentId
        : null;
      return {
        title: String(item.title).slice(0, 80),
        role,
        description: typeof item.description === 'string' ? item.description : '',
        acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
          ? item.acceptanceCriteria.map(String)
          : [],
        dependsOnIndices: Array.isArray(item.dependsOnIndices)
          ? item.dependsOnIndices.filter((idx: unknown) => typeof idx === 'number')
          : [],
        environmentId: envId,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse Claude response: ${msg}`, raw }, { status: 502 });
  }

  return NextResponse.json({ cards });
}
