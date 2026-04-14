export type ColumnType = 'inactive' | 'active' | 'blocked' | 'review' | 'revision' | 'terminal';

/**
 * Authoritative transition matrix for drag-and-drop and server-side move validation.
 * Same-type reorders (e.g. active → active) are listed so positional moves within a
 * column are also permitted.
 * Source of truth per PRD §5.2 / §6.
 */
export const VALID_TRANSITIONS: Record<ColumnType, ColumnType[]> = {
  inactive: ['active'],
  active: ['active', 'inactive', 'blocked', 'review'],
  blocked: ['active'],
  review: ['terminal', 'revision'],
  revision: ['active'],
  terminal: [],
};

export type AgentStatus =
  | 'idle'
  | 'queued'
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
  sessionId: string | null;
  retryAfterMs: number | null;
  error: string | null;
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
  /** Whether the current user has RBAC access to interact with this card. Defaults to true when omitted. */
  canInteract?: boolean;
  /** IDs of cards this card depends on. */
  dependsOn?: string[];
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
  githubRepo: string | null;
  workspacePath: string | null;
  autoMode: boolean;
  columnCount?: number;
  cardCount?: number;
  completedCardCount?: number;
}

export interface KobaniStore {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  agentRuns: AgentRun[];
}
