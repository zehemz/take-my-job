export enum AgentRunStatus {
  pending = "pending",
  running = "running",
  idle = "idle",
  blocked = "blocked",
  completed = "completed",
  failed = "failed",
  cancelled = "cancelled",
}

export interface Board {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  columns?: Column[];
  cards?: Card[];
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isActiveState: boolean;
  isTerminalState: boolean;
  columnType: string;
  board?: Board;
  cards?: Card[];
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  role: string | null;
  position: number;
  githubRepoUrl: string | null;
  githubBranch: string | null;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  board?: Board;
  column?: Column;
  agentRuns?: AgentRun[];
}

export interface AgentRun {
  id: string;
  cardId: string;
  /** Column that triggered this run (set at creation time). */
  columnId: string;
  role: string;
  sessionId: string | null;
  status: AgentRunStatus;
  output: string | null;
  criteriaResults: string | null;
  blockedReason: string | null;
  attempt: number;
  retryAfterMs: bigint | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  card?: Card;
}

export interface AgentConfig {
  id: string;
  role: string;
  anthropicAgentId: string;
  anthropicAgentVersion: string;
  anthropicEnvironmentId: string;
  createdAt: Date;
}

export interface CriterionResult {
  criterion: string;
  passed: boolean;
  evidence: string;
}

export interface UpdateCardInput {
  status: "in_progress" | "completed" | "blocked";
  summary: string;
  next_column?: string;
  criteria_results?: CriterionResult[];
  blocked_reason?: string;
}

/** SSE event types broadcast to the UI */
export type BroadcastEvent =
  | { type: "agent_message"; text: string }
  | { type: "agent_thinking"; thinking: string }
  | { type: "tool_use"; tool_name: string; input: unknown }
  | { type: "card_update"; status: string; summary: string; next_column?: string; criteria_results?: CriterionResult[] }
  | { type: "card_blocked"; reason: string; session_id: string; cli_command: string }
  | { type: "status_change"; status: AgentRunStatus }
  | { type: "error"; message: string }
  | { type: "done" };
