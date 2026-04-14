export type ColumnType = 'inactive' | 'active' | 'review' | 'revision' | 'terminal';

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'evaluating'
  | 'evaluation-failed'
  | 'pending-approval'
  | 'completed';

export type AgentRole =
  | 'backend-engineer'
  | 'qa-engineer'
  | 'tech-lead'
  | 'content-writer'
  | 'product-spec-writer'
  | 'designer';

export interface AcceptanceCriterion {
  id: string;
  text: string;
  passed: boolean | null;
  evidence: string | null;
}

export interface AgentRun {
  id: string;
  cardId: string;
  role: AgentRole;
  status: AgentStatus;
  attempt: number;
  startedAt: string;
  endedAt: string | null;
  output: string;
  blockedReason: string | null;
  retryAfterMs: number | null;
}

export interface Card {
  id: string;
  columnId: string;
  boardId: string;
  position: number;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  role: AgentRole;
  assignee: string;
  githubRepo: string | null;
  githubBranch: string | null;
  agentStatus: AgentStatus;
  currentAgentRunId: string | null;
  agentRuns: AgentRun[];
  requiresApproval: boolean;
  revisionContextNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movedToColumnAt: string;
  /** Maximum agent attempts, from MAX_ATTEMPTS env var (passed through API). Defaults to 5. */
  maxAttempts?: number;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  type: ColumnType;
  position: number;
}

export interface Board {
  id: string;
  name: string;
  createdAt: string;
}

export interface KobaniStore {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  agentRuns: AgentRun[];
}
