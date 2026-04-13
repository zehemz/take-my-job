// Hour 0 shared interfaces — the contracts all engineers build against.
// Engineer 1 owns the real implementations; everyone else uses these + stubs.

import type { Card, Column, AgentRun, AgentConfig, AgentRunStatus } from "./types";

// ---------------------------------------------------------------------------
// IDbQueries
// ---------------------------------------------------------------------------

export interface CreateAgentRunInput {
  cardId: string;
  columnId: string;
  role: string;
  attempt: number;
}

export interface UpdateAgentRunInput {
  status?: AgentRunStatus;
  sessionId?: string;
  output?: string;
  criteriaResults?: string;
  blockedReason?: string;
  retryAfterMs?: number | null;
  error?: string;
}

export interface IDbQueries {
  getEligibleCards(maxConcurrent: number, claimedIds: Set<string>): Promise<Card[]>;
  createAgentRun(input: CreateAgentRunInput): Promise<AgentRun>;
  updateAgentRunStatus(id: string, status: AgentRunStatus, extra?: UpdateAgentRunInput): Promise<AgentRun>;
  appendAgentRunOutput(id: string, chunk: string): Promise<void>;
  getAgentConfig(role: string): Promise<AgentConfig | null>;
  getRunningRuns(): Promise<AgentRun[]>;
  getCard(id: string): Promise<(Card & { column: Column }) | null>;
  moveCard(cardId: string, newColumnId: string): Promise<Card>;
  getRetryEligibleRuns(): Promise<AgentRun[]>;
  getColumnByName(boardId: string, name: string): Promise<Column | null>;
  getBoardColumns(boardId: string): Promise<Column[]>;
}

// ---------------------------------------------------------------------------
// IAnthropicClient
// ---------------------------------------------------------------------------

export interface SessionCreateInput {
  agentId: string;
  agentVersion: string;
  environmentId: string;
  title: string;
  resources?: GitHubRepositoryResource[];
}

export interface GitHubRepositoryResource {
  type: "github_repository";
  url: string;
  authorization_token: string;
  mount_path: string;
  checkout: { type: "branch"; name: string };
}

export interface AgentSessionEvent {
  type: string;
  [key: string]: unknown;
}

export interface SessionStatus {
  id: string;
  status: "running" | "idle" | "terminated";
  stop_reason?: { type: string; [key: string]: unknown };
}

export interface IAnthropicClient {
  createSession(input: SessionCreateInput): Promise<{ id: string }>;
  streamSession(sessionId: string): AsyncIterable<AgentSessionEvent>;
  sendMessage(sessionId: string, message: Record<string, unknown>): Promise<void>;
  retrieveSession(sessionId: string): Promise<SessionStatus>;
  interruptSession(sessionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// IBroadcaster
// ---------------------------------------------------------------------------

export interface BroadcastEvent {
  type: string;
  cardId: string;
  [key: string]: unknown;
}

export type BroadcastHandler = (event: BroadcastEvent) => void;
export type Unsubscribe = () => void;

export interface IBroadcaster {
  emit(cardId: string, event: BroadcastEvent): void;
  subscribe(cardId: string, handler: BroadcastHandler): Unsubscribe;
}

// ---------------------------------------------------------------------------
// IOrchestrator
// ---------------------------------------------------------------------------

export interface IOrchestrator {
  notifyCardMoved(cardId: string, newColumnId: string): Promise<void>;
}
