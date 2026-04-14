import { prisma } from "./db";
import type { IDbQueries } from "./interfaces";
import type { AgentRun, Card, Column, OrchestratorEvent } from "./types";
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
          status: { in: ["pending", "running", "idle"] },
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

      // Only block dispatch if the card was completed *during its current stint*
      // in this column. A card returned via revision may have old completed runs
      // from prior stints — those should not prevent a fresh dispatch.
      const completedInColumn = await prisma.agentRun.findFirst({
        where: {
          cardId: card.id,
          status: "completed",
          ...(card.movedToColumnAt
            ? { createdAt: { gte: card.movedToColumnAt } }
            : {}),
        },
      });
      if (completedInColumn) continue;

      eligible.push(card as unknown as Card);
      if (eligible.length >= maxConcurrent) break;
    }

    return eligible;
  },

  async createAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun> {
    const run = await prisma.agentRun.create({
      data: {
        cardId,
        columnId,
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
    let config = await prisma.agentConfig.findUnique({ where: { role } });
    if (!config) {
      // Try alternate format: hyphens ↔ underscores
      const alt = role.includes('-')
        ? role.replace(/-/g, '_')
        : role.replace(/_/g, '-');
      config = await prisma.agentConfig.findUnique({ where: { role: alt } });
    }
    return config as unknown as import("./types").AgentConfig | null;
  },

  async getRunningRuns(): Promise<AgentRun[]> {
    const runs = await prisma.agentRun.findMany({
      where: { status: { in: ["running", "idle", "blocked"] } },
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

  async getBoard(id: string) {
    const board = await prisma.board.findUnique({ where: { id } });
    return board as unknown as import("./types").Board | null;
  },

  async getBoardColumns(boardId: string): Promise<Column[]> {
    const columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    return columns as unknown as Column[];
  },

  async moveCardToColumnType(cardId: string, boardId: string, targetColumnType: 'review' | 'terminal' | 'blocked'): Promise<void> {
    const col = await prisma.column.findFirst({
      where: { boardId, columnType: targetColumnType },
    });
    if (!col) throw new Error(`No ${targetColumnType} column on board ${boardId}`);
    await prisma.card.update({
      where: { id: cardId },
      data: { columnId: col.id, movedToColumnAt: new Date() },
    });
  },

  async getActiveRunForCard(cardId: string): Promise<AgentRun | null> {
    const run = await prisma.agentRun.findFirst({
      where: {
        cardId,
        status: { in: ["pending", "running", "idle", "blocked"] },
      },
      orderBy: { createdAt: "desc" },
    });
    return run as unknown as AgentRun | null;
  },

  async claimAndCreateAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun | null> {
    return prisma.$transaction(async (tx) => {
      // Lock the card row — skip if another process already locked it
      const locked: Array<{ id: string }> = await tx.$queryRawUnsafe(
        `SELECT id FROM "Card" WHERE id = $1 FOR UPDATE SKIP LOCKED`,
        cardId,
      );
      if (locked.length === 0) return null;

      // Guard: if the card already has an active, completed, or blocked run, bail out
      const blockingRun = await tx.agentRun.findFirst({
        where: { cardId, status: { in: ["running", "idle", "pending", "completed", "blocked"] } },
      });
      if (blockingRun) return null;

      const run = await tx.agentRun.create({
        data: { cardId, columnId, role, status: "pending", attempt },
      });
      return run as unknown as AgentRun;
    });
  },

  async countActiveRuns(): Promise<number> {
    return prisma.agentRun.count({
      where: { status: { in: ["running", "idle", "pending"] } },
    });
  },

  async getActiveRuns(): Promise<Array<AgentRun & { card: Card & { column: Column } }>> {
    const runs = await prisma.agentRun.findMany({
      where: { status: { in: ["running", "idle"] } },
      include: { card: { include: { column: true } } },
    });
    return runs as unknown as Array<AgentRun & { card: Card & { column: Column } }>;
  },

  async insertOrchestratorEvent(event: { boardId: string; cardId: string; runId?: string; type: string; payload: Record<string, unknown> }): Promise<void> {
    await prisma.orchestratorEvent.create({
      data: {
        boardId: event.boardId,
        cardId: event.cardId,
        runId: event.runId ?? null,
        type: event.type,
        payload: event.payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
  },

  async getOrchestratorEventsSince(since: Date, types: string[]): Promise<OrchestratorEvent[]> {
    const events = await prisma.orchestratorEvent.findMany({
      where: {
        createdAt: { gt: since },
        type: { in: types },
      },
      orderBy: { createdAt: "asc" },
    });
    return events as unknown as OrchestratorEvent[];
  },

  async getCardEventsSince(cardId: string, since: Date): Promise<OrchestratorEvent[]> {
    const events = await prisma.orchestratorEvent.findMany({
      where: {
        cardId,
        createdAt: { gt: since },
        type: { notIn: ["card_moved", "card_unblocked"] },
      },
      orderBy: { createdAt: "asc" },
    });
    return events as unknown as OrchestratorEvent[];
  },
};
