import type { IDbQueries } from "../interfaces.js";
import type { AgentConfig, AgentRun, AgentRunStatus, Board, Card, Column } from "../types.js";
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
          (r) => r.cardId === c.id && (r.status === Status.running || r.status === Status.idle),
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
    extra?: { sessionId?: string; retryAfterMs?: number; error?: string; criteriaResults?: string; output?: string; blockedReason?: string },
  ): Promise<AgentRun> {
    const run = this.agentRuns.find((r) => r.id === id);
    if (!run) throw new Error(`AgentRun ${id} not found`);
    run.status = status;
    run.updatedAt = new Date();
    if (extra?.sessionId !== undefined) run.sessionId = extra.sessionId;
    if (extra?.retryAfterMs !== undefined) run.retryAfterMs = BigInt(extra.retryAfterMs);
    if (extra?.error !== undefined) run.error = extra.error;
    if (extra?.criteriaResults !== undefined) run.criteriaResults = extra.criteriaResults;
    if (extra?.output !== undefined) run.output = extra.output;
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
    return this.agentRuns.filter(
      (r) => r.status === Status.running || r.status === Status.idle || r.status === Status.blocked,
    );
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
    return this.columns.filter((c) => c.boardId === boardId).sort((a, b) => a.position - b.position);
  }

  async moveCardToColumnType(cardId: string, boardId: string, targetColumnType: 'review' | 'terminal' | 'blocked'): Promise<void> {
    const col = this.columns.find((c) => c.boardId === boardId && c.columnType === targetColumnType);
    if (!col) throw new Error(`No ${targetColumnType} column on board ${boardId}`);
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    card.columnId = col.id;
    card.updatedAt = new Date();
  }

  async getActiveRunForCard(cardId: string): Promise<AgentRun | null> {
    const activeStatuses = new Set<AgentRunStatus>([Status.pending, Status.running, Status.idle, Status.blocked]);
    const runs = this.agentRuns
      .filter((r) => r.cardId === cardId && activeStatuses.has(r.status as AgentRunStatus))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return runs[0] ?? null;
  }
}
