// Shared entity types — Hour 0 stub. Engineer 1 owns the Prisma-generated versions;
// this file is the plain-TS contract all engineers build against.

export type AgentRunStatus =
  | "pending"
  | "running"
  | "idle"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export interface Board {
  id: string;
  name: string;
  columns: Column[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isActiveState: boolean;
  isTerminalState: boolean;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  role?: string | null;
  position: number;
  githubRepoUrl?: string | null;
  githubBranch?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRun {
  id: string;
  cardId: string;
  columnId: string;
  role: string;
  sessionId?: string | null;
  status: AgentRunStatus;
  output?: string | null;
  criteriaResults?: string | null; // JSON: CriterionResult[]
  blockedReason?: string | null;
  attempt: number;
  retryAfterMs?: number | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
