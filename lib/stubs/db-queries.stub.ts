import type { IDbQueries } from "../interfaces";
import type { AgentConfig, AgentRun, Card, Column } from "../types";
import { AgentRunStatus } from "../types";

export function createDbQueriesStub(initialData?: {
  cards?: Card[];
  columns?: Column[];
  agentRuns?: AgentRun[];
  agentConfigs?: AgentConfig[];
}): IDbQueries {
  const cards = new Map<string, Card>((initialData?.cards ?? []).map((c) => [c.id, c]));
  const columns = new Map<string, Column>((initialData?.columns ?? []).map((c) => [c.id, c]));
  const agentRuns = new Map<string, AgentRun>((initialData?.agentRuns ?? []).map((r) => [r.id, r]));
  const agentConfigs = new Map<string, AgentConfig>((initialData?.agentConfigs ?? []).map((c) => [c.role, c]));
  let runIdCounter = 1;

  return {
    async getEligibleCards(maxConcurrent, claimedIds) {
      return Array.from(cards.values())
        .filter((c) => {
          const col = columns.get(c.columnId);
          if (!col?.isActiveState) return false;
          if (claimedIds.has(c.id)) return false;
          const hasActive = Array.from(agentRuns.values()).some(
            (r) => r.cardId === c.id && (r.status === AgentRunStatus.running || r.status === AgentRunStatus.idle),
          );
          return !hasActive;
        })
        .slice(0, maxConcurrent);
    },

    async createAgentRun(cardId, _columnId, role, attempt) {
      const id = `run_${runIdCounter++}`;
      const run: AgentRun = {
        id,
        cardId,
        role,
        sessionId: null,
        status: AgentRunStatus.pending,
        output: null,
        criteriaResults: null,
        blockedReason: null,
        attempt,
        retryAfterMs: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      agentRuns.set(id, run);
      return run;
    },

    async updateAgentRunStatus(id, status, extra) {
      const run = agentRuns.get(id);
      if (!run) throw new Error(`AgentRun ${id} not found`);
      const updated = { ...run, status: status as AgentRunStatus, ...extra, updatedAt: new Date() };
      agentRuns.set(id, updated);
      return updated;
    },

    async appendAgentRunOutput(id, chunk) {
      const run = agentRuns.get(id);
      if (!run) throw new Error(`AgentRun ${id} not found`);
      run.output = (run.output ?? "") + chunk;
      run.updatedAt = new Date();
    },

    async getAgentConfig(role) {
      return agentConfigs.get(role) ?? null;
    },

    async getRunningRuns() {
      return Array.from(agentRuns.values()).filter(
        (r) => r.status === AgentRunStatus.running || r.status === AgentRunStatus.idle,
      );
    },

    async getCard(id) {
      const card = cards.get(id);
      if (!card) return null;
      const column = columns.get(card.columnId);
      if (!column) return null;
      return { ...card, column } as Card & { column: Column };
    },

    async moveCard(cardId, newColumnId) {
      const card = cards.get(cardId);
      if (!card) throw new Error(`Card ${cardId} not found`);
      card.columnId = newColumnId;
      card.updatedAt = new Date();
      return card;
    },

    async getRetryEligibleRuns() {
      const now = BigInt(Date.now());
      return Array.from(agentRuns.values()).filter(
        (r) => r.status === AgentRunStatus.failed && r.retryAfterMs !== null && r.retryAfterMs <= now,
      );
    },

    async getColumnByName(boardId, name) {
      return Array.from(columns.values()).find((c) => c.boardId === boardId && c.name === name) ?? null;
    },

    async getBoardColumns(boardId) {
      return Array.from(columns.values())
        .filter((c) => c.boardId === boardId)
        .sort((a, b) => a.position - b.position);
    },
  };
}
