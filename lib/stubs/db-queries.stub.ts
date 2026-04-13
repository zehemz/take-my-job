import type { IDbQueries } from "../interfaces.js";
import type { AgentConfig, AgentRun, AgentRunStatus, BroadcastEvent, Board, Card, Column } from "../types.js";
import { AgentRunStatus as Status } from "../types.js";

let idCounter = 0;
function nextId(): string {
  return `stub-${++idCounter}`;
}

export class StubDbQueries implements IDbQueries {
  boards: Board[] = [];
  columns: Column[] = [];
  cards: Card[] = [];
  agentRuns: AgentRun[] = [];
  agentConfigs: AgentConfig[] = [];
  runEvents: Array<{ id: number; cardId: string; runId: string; event: BroadcastEvent }> = [];
  private runEventIdCounter = 0;

  static resetIdCounter(): void {
    idCounter = 0;
  }

  async getEligibleCards(maxConcurrent: number, claimedIds: string[]): Promise<Card[]> {
    const activeColumnIds = new Set(
      this.columns.filter((c) => c.isActiveState).map((c) => c.id),
    );
    const claimedSet = new Set(claimedIds);
    return this.cards
      .filter((c) => {
        if (!activeColumnIds.has(c.columnId)) return false;
        if (claimedSet.has(c.id)) return false;
        const hasActive = this.agentRuns.some(
          (r) => r.cardId === c.id && (r.status === Status.pending || r.status === Status.running || r.status === Status.idle),
        );
        return !hasActive;
      })
      .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, maxConcurrent);
  }

  async createAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun> {
    const now = new Date();
    const run: AgentRun = {
      id: nextId(),
      cardId,
      columnId,
      role,
      sessionId: null,
      status: Status.pending,
      output: null,
      criteriaResults: null,
      blockedReason: null,
      attempt,
      retryAfterMs: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.agentRuns.push(run);
    return run;
  }

  async updateAgentRunStatus(
    id: string,
    status: AgentRunStatus,
    extra?: { retryAfterMs?: number; error?: string; criteriaResults?: string; output?: string; sessionId?: string; blockedReason?: string },
  ): Promise<AgentRun> {
    const run = this.agentRuns.find((r) => r.id === id);
    if (!run) throw new Error(`AgentRun ${id} not found`);
    run.status = status;
    run.updatedAt = new Date();
    if (extra?.retryAfterMs !== undefined) run.retryAfterMs = BigInt(extra.retryAfterMs);
    if (extra?.error !== undefined) run.error = extra.error;
    if (extra?.criteriaResults !== undefined) run.criteriaResults = extra.criteriaResults;
    if (extra?.output !== undefined) run.output = extra.output;
    if (extra?.sessionId !== undefined) run.sessionId = extra.sessionId;
    if (extra?.blockedReason !== undefined) run.blockedReason = extra.blockedReason;
    return run;
  }

  async appendAgentRunOutput(id: string, chunk: string): Promise<void> {
    const run = this.agentRuns.find((r) => r.id === id);
    if (!run) throw new Error(`AgentRun ${id} not found`);
    run.output = (run.output ?? "") + chunk;
    run.updatedAt = new Date();
  }

  async getAgentConfig(role: string): Promise<AgentConfig | null> {
    return this.agentConfigs.find((c) => c.role === role) ?? null;
  }

  async getRunningRuns(): Promise<AgentRun[]> {
    return this.agentRuns.filter((r) => r.status === Status.running || r.status === Status.idle);
  }

  async getCard(id: string): Promise<(Card & { column: Column }) | null> {
    const card = this.cards.find((c) => c.id === id);
    if (!card) return null;
    const column = this.columns.find((c) => c.id === card.columnId);
    if (!column) return null;
    return { ...card, column };
  }

  async moveCard(cardId: string, newColumnId: string): Promise<Card> {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    card.columnId = newColumnId;
    card.updatedAt = new Date();
    return card;
  }

  async getRetryEligibleRuns(): Promise<AgentRun[]> {
    const now = BigInt(Date.now());
    return this.agentRuns.filter(
      (r) => r.status === Status.failed && r.retryAfterMs != null && r.retryAfterMs <= now,
    );
  }

  async getColumnByName(boardId: string, name: string): Promise<Column | null> {
    return this.columns.find((c) => c.boardId === boardId && c.name === name) ?? null;
  }

  async getBoardColumns(boardId: string): Promise<Column[]> {
    return this.columns
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.position - b.position);
  }

  async getAgentRun(id: string): Promise<AgentRun | null> {
    return this.agentRuns.find((r) => r.id === id) ?? null;
  }

  async insertRunEvent(cardId: string, runId: string, event: BroadcastEvent): Promise<void> {
    this.runEvents.push({ id: ++this.runEventIdCounter, cardId, runId, event });
  }

  async getRunEventsSince(
    cardId: string,
    afterId: number,
  ): Promise<Array<{ id: number; event: BroadcastEvent }>> {
    return this.runEvents
      .filter((e) => e.cardId === cardId && e.id > afterId)
      .map((e) => ({ id: e.id, event: e.event }));
  }

  boardEvents: Array<{ id: number; boardId: string; event: BroadcastEvent }> = [];
  private boardEventIdCounter = 0;

  async insertBoardEvent(boardId: string, event: BroadcastEvent): Promise<void> {
    this.boardEvents.push({ id: ++this.boardEventIdCounter, boardId, event });
  }

  async getBoardEventsSince(
    boardId: string,
    afterId: number,
  ): Promise<Array<{ id: number; event: BroadcastEvent }>> {
    return this.boardEvents
      .filter((e) => e.boardId === boardId && e.id > afterId)
      .map((e) => ({ id: e.id, event: e.event }));
  }
}
