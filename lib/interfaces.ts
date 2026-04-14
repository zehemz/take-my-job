import type { AgentConfig, AgentRun, AgentRunStatus, BroadcastEvent, Card, Column } from "./types.js";

export interface IDbQueries {
  getEligibleCards(maxConcurrent: number, claimedIds: string[]): Promise<Card[]>;
  createAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun>;
  updateAgentRunStatus(id: string, status: AgentRunStatus, extra?: { sessionId?: string; retryAfterMs?: number; error?: string; criteriaResults?: string; output?: string; blockedReason?: string }): Promise<AgentRun>;
  appendAgentRunOutput(id: string, chunk: string): Promise<void>;
  getAgentConfig(role: string): Promise<AgentConfig | null>;
  getRunningRuns(): Promise<AgentRun[]>;
  getCard(id: string): Promise<(Card & { column: Column }) | null>;
  getBoard(id: string): Promise<import("./types").Board | null>;
  moveCard(cardId: string, newColumnId: string): Promise<Card>;
  getRetryEligibleRuns(): Promise<AgentRun[]>;
  getColumnByName(boardId: string, name: string): Promise<Column | null>;
  getBoardColumns(boardId: string): Promise<Column[]>;
  moveCardToColumnType(cardId: string, boardId: string, targetColumnType: 'review' | 'terminal' | 'blocked'): Promise<void>;
  getActiveRunForCard(cardId: string): Promise<AgentRun | null>;
}

/** Typed events emitted by the Anthropic Managed Agents SSE stream. */
export type AgentEvent =
  | { type: "agent.message"; content: Array<{ type: string; text?: string }> }
  | { type: "agent.thinking" }
  | { type: "agent.tool_use"; name: string; input: unknown }
  | { type: "agent.custom_tool_use"; id: string; name: string; input: unknown }
  | { type: "session.status_idle"; stop_reason: { type: "end_turn" | "retries_exhausted" | "requires_action"; event_ids?: string[] } }
  | { type: "session.status_terminated" }
  | { type: "session.error"; error: { message: string } }
  | { type: "span.model_request_end"; model_usage: { input_tokens: number; output_tokens: number } };

export interface SessionInfo {
  id: string;
  status: "running" | "idle" | "terminated";
  outcome?: "success" | "error";
}

export interface IAnthropicClient {
  createSession(config: {
    agentId: string;
    agentVersion: string;
    environmentId: string;
    title: string;
    resources?: Array<{
      type: "github_repository";
      url: string;
      authorization_token?: string;
      mount_path: string;
      checkout: { type: "branch"; name: string };
    }>;
  }): Promise<{ id: string }>;

  streamSession(sessionId: string): AsyncIterable<AgentEvent>;

  sendMessage(sessionId: string, message: {
    type: "user.message" | "user.custom_tool_result" | "user.interrupt";
    [key: string]: unknown;
  }): Promise<void>;

  retrieveSession(sessionId: string): Promise<SessionInfo>;

  interruptSession(sessionId: string): Promise<void>;
}

export interface IBroadcaster {
  emit(cardId: string, event: BroadcastEvent): void;
  subscribe(cardId: string, handler: (event: BroadcastEvent) => void): () => void;
}

export interface IOrchestrator {
  start(): Promise<void>;
  stop(): void;
  notifyCardMoved(cardId: string, newColumnId: string): Promise<void>;
  notifyCardUnblocked(cardId: string, run: AgentRun): Promise<void>;
  /** Release a card from the in-memory claimed set so the next poll tick can re-dispatch it. */
  unclaim(cardId: string): void;
}
