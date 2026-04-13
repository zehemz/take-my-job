import { prisma } from "./db";
import type { IDbQueries } from "./interfaces";
import type { AgentRun, Card, Column } from "./types";
import { AgentRunStatus } from "./types";

export const dbQueries: IDbQueries = {
  async getEligibleCards(maxConcurrent: number, claimedIds: string[]): Promise<Card[]> {
    const claimedArray = claimedIds;

    const cards = await prisma.card.findMany({
      where: {
        column: { isActiveState: true },
        ...(claimedArray.length > 0 ? { id: { notIn: claimedArray } } : {}),
      },
      include: { column: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    // Filter out cards that already have a running/idle run,
    // a future retry, or a completed run for the current column
    const eligible: Card[] = [];
    for (const card of cards) {
      const activeRun = await prisma.agentRun.findFirst({
        where: {
          cardId: card.id,
          status: { in: ["running", "idle"] },
        },
      });
      if (activeRun) continue;

      const futureRetry = await prisma.agentRun.findFirst({
        where: {
          cardId: card.id,
          status: "failed",
          retryAfterMs: { gt: BigInt(Date.now()) },
        },
      });
      if (futureRetry) continue;

      const completedInColumn = await prisma.agentRun.findFirst({
        where: {
          cardId: card.id,
          status: "completed",
        },
      });
      // If there's a completed run, the card was already handled
      // (the spec says no completed run whose columnId matches current column,
      //  but AgentRun doesn't have columnId in our schema — we check by existence)
      if (completedInColumn) continue;

      eligible.push(card as unknown as Card);
      if (eligible.length >= maxConcurrent) break;
    }

    return eligible;
  },

  async createAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun> {
    // Note: our Prisma schema doesn't have columnId on AgentRun.
    // We store it as metadata if needed, but create the run with what we have.
    const run = await prisma.agentRun.create({
      data: {
        cardId,
        role,
        status: "pending",
        attempt,
      },
    });
    return run as unknown as AgentRun;
  },

  async updateAgentRunStatus(id: string, status: AgentRunStatus, extra?: { sessionId?: string; retryAfterMs?: number; error?: string; criteriaResults?: string; output?: string; blockedReason?: string }): Promise<AgentRun> {
    const data: Record<string, unknown> = { status };
    if (extra?.sessionId !== undefined) data.sessionId = extra.sessionId;
    if (extra?.output !== undefined) data.output = extra.output;
    if (extra?.criteriaResults !== undefined) data.criteriaResults = extra.criteriaResults;
    if (extra?.blockedReason !== undefined) data.blockedReason = extra.blockedReason;
    if (extra?.retryAfterMs !== undefined) data.retryAfterMs = extra.retryAfterMs;
    if (extra?.error !== undefined) data.error = extra.error;

    const run = await prisma.agentRun.update({
      where: { id },
      data,
    });
    return run as unknown as AgentRun;
  },

  async appendAgentRunOutput(id: string, chunk: string): Promise<void> {
    const run = await prisma.agentRun.findUnique({ where: { id } });
    await prisma.agentRun.update({
      where: { id },
      data: { output: (run?.output ?? "") + chunk },
    });
  },

  async getAgentConfig(role: string) {
    const config = await prisma.agentConfig.findUnique({ where: { role } });
    return config as unknown as import("./types").AgentConfig | null;
  },

  async getRunningRuns(): Promise<AgentRun[]> {
    const runs = await prisma.agentRun.findMany({
      where: { status: { in: ["running", "idle"] } },
    });
    return runs as unknown as AgentRun[];
  },

  async getCard(id: string) {
    const card = await prisma.card.findUnique({
      where: { id },
      include: { column: true },
    });
    return card as unknown as (Card & { column: Column }) | null;
  },

  async moveCard(cardId: string, newColumnId: string): Promise<Card> {
    const card = await prisma.card.update({
      where: { id: cardId },
      data: { columnId: newColumnId },
    });
    return card as unknown as Card;
  },

  async getRetryEligibleRuns(): Promise<AgentRun[]> {
    const runs = await prisma.agentRun.findMany({
      where: {
        status: "failed",
        retryAfterMs: { lte: BigInt(Date.now()) },
      },
    });
    return runs as unknown as AgentRun[];
  },

  async getColumnByName(boardId: string, name: string): Promise<Column | null> {
    const column = await prisma.column.findFirst({
      where: { boardId, name },
    });
    return column as unknown as Column | null;
  },

  async getBoardColumns(boardId: string): Promise<Column[]> {
    const columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    return columns as unknown as Column[];
  },
};
