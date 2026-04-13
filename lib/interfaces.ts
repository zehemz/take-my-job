import type { AgentConfig, AgentRun, BroadcastEvent, Card, Column } from "./types";

export interface IDbQueries {
  getEligibleCards(maxConcurrent: number, claimedIds: Set<string>): Promise<Card[]>;
  createAgentRun(cardId: string, columnId: string, role: string, attempt: number): Promise<AgentRun>;
  updateAgentRunStatus(id: string, status: string, extra?: Partial<AgentRun>): Promise<AgentRun>;
  appendAgentRunOutput(id: string, chunk: string): Promise<void>;
  getAgentConfig(role: string): Promise<AgentConfig | null>;
  getRunningRuns(): Promise<AgentRun[]>;
  getCard(id: string): Promise<(Card & { column: Column }) | null>;
  moveCard(cardId: string, newColumnId: string): Promise<Card>;
  getRetryEligibleRuns(): Promise<AgentRun[]>;
  getColumnByName(boardId: string, name: string): Promise<Column | null>;
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

  streamSession(sessionId: string): Promise<AsyncIterable<unknown>>;

  sendMessage(sessionId: string, message: {
    type: "user.message" | "user.custom_tool_result" | "user.interrupt";
    [key: string]: unknown;
  }): Promise<void>;

  retrieveSession(sessionId: string): Promise<{
    id: string;
    status: string;
    stop_reason?: { type: string } | null;
  }>;

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
}
