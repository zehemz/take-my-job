import { AgentRunStatus, AgentConfig } from '@prisma/client';
import type { AgentStatus, AgentRole, ColumnType } from './kanban-types';
import type {
  ApiAgentRun,
  ApiCard,
  ApiColumn,
  ApiBoardSummary,
  ApiAcceptanceCriterion,
  AgentConfigItem,
  ApiNotification,
  NotificationType,
} from './api-types';

// ─── Status mapping ───────────────────────────────────────────────────────────

/**
 * Maps a DB AgentRunStatus (+ optional criteriaResults JSON) to the richer
 * frontend AgentStatus union.
 *
 * DB enum:  pending | running | idle | blocked | completed | failed | cancelled
 * Frontend: idle | running | blocked | failed | evaluating | evaluation-failed |
 *           pending-approval | completed
 */
export function mapAgentRunStatus(
  status: AgentRunStatus,
  criteriaResults: string | null,
): AgentStatus {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'idle':
    case 'cancelled':
      return 'idle';
    case 'running':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'failed':
      return 'failed';
    case 'completed': {
      if (!criteriaResults) return 'completed';
      try {
        const results = JSON.parse(criteriaResults) as Array<{ passed: boolean }>;
        return results.every((r) => r.passed) ? 'completed' : 'evaluation-failed';
      } catch {
        return 'completed';
      }
    }
    default:
      return 'idle';
  }
}

/** Derive a card's effective AgentStatus from all its runs (sorted oldest→newest). */
export function deriveCardAgentStatus(
  runs: Array<{ status: AgentRunStatus; criteriaResults: string | null }>,
): AgentStatus {
  if (runs.length === 0) return 'idle';
  const latest = runs[runs.length - 1];
  return mapAgentRunStatus(latest.status, latest.criteriaResults);
}

// ─── Column mapping ───────────────────────────────────────────────────────────

export function mapColumn(col: {
  id: string;
  boardId: string;
  name: string;
  position: number;
  columnType: string;
}): ApiColumn {
  return {
    id: col.id,
    boardId: col.boardId,
    name: col.name,
    position: col.position,
    type: col.columnType as ColumnType,
  };
}

// ─── Board mapping ────────────────────────────────────────────────────────────

export function mapBoardSummary(board: {
  id: string;
  name: string;
  githubRepo?: string | null;
  workspacePath?: string | null;
  anthropicEnvironmentId?: string | null;
  autoMode?: boolean;
  createdAt: Date;
  _count?: { columns: number; cards: number };
}): ApiBoardSummary {
  return {
    id: board.id,
    name: board.name,
    githubRepo: board.githubRepo ?? null,
    workspacePath: board.workspacePath ?? null,
    environmentId: board.anthropicEnvironmentId ?? null,
    autoMode: board.autoMode ?? false,
    createdAt: board.createdAt.toISOString(),
    columnCount: board._count?.columns ?? 0,
    cardCount: board._count?.cards ?? 0,
  };
}

// ─── AcceptanceCriteria parsing ───────────────────────────────────────────────

/**
 * Parse the acceptanceCriteria DB field (stored as a JSON string) into a typed
 * array. Falls back gracefully for plain-text legacy values.
 */
export function parseAcceptanceCriteria(raw: string | null): ApiAcceptanceCriterion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ApiAcceptanceCriterion[];
    return [];
  } catch {
    return [{ id: '1', text: raw, passed: null, evidence: null }];
  }
}

// ─── AgentRun mapping ─────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set<AgentRunStatus>([AgentRunStatus.completed, AgentRunStatus.failed, AgentRunStatus.cancelled]);

export function mapAgentRun(run: {
  id: string;
  cardId: string;
  columnId?: string | null;
  role: string;
  sessionId?: string | null;
  status: AgentRunStatus;
  attempt: number;
  output: string | null;
  blockedReason: string | null;
  retryAfterMs: bigint | null;
  criteriaResults: string | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ApiAgentRun {
  return {
    id: run.id,
    cardId: run.cardId,
    columnId: run.columnId ?? null,
    role: run.role as AgentRole,
    status: mapAgentRunStatus(run.status, run.criteriaResults),
    attempt: run.attempt,
    startedAt: run.createdAt.toISOString(),
    endedAt: TERMINAL_STATUSES.has(run.status) ? run.updatedAt.toISOString() : null,
    output: run.output ?? '',
    blockedReason: run.blockedReason,
    sessionId: run.sessionId ?? null,
    retryAfterMs: run.retryAfterMs !== null ? Number(run.retryAfterMs) : null,
    error: run.error ?? null,
  };
}

// ─── Card mapping ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS ?? '5', 10);

export function mapCard(
  card: {
    id: string;
    columnId: string;
    boardId: string;
    position: number;
    title: string;
    description: string | null;
    acceptanceCriteria: string | null;
    role: string | null;
    githubRepoUrl: string | null;
    githubBranch: string | null;
    requiresApproval: boolean;
    movedToColumnAt: Date | null;
    revisionContextNote: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dependsOn?: Array<{ id: string }>;
  },
  mappedRuns: ApiAgentRun[],
  agentStatus: AgentStatus,
  columnType?: string,
  canInteract?: boolean,
): ApiCard {
  // Post-hoc override: if the agent completed and the card is in a review column,
  // surface 'pending-approval' status to the client.
  let effectiveAgentStatus = agentStatus;
  if (agentStatus === 'completed' && columnType === 'review') {
    effectiveAgentStatus = 'pending-approval';
  }

  const currentRun =
    mappedRuns.find((r) => r.status === 'running') ??
    mappedRuns.find((r) => r.status === 'blocked') ??
    (mappedRuns.length > 0 ? mappedRuns[mappedRuns.length - 1] : null);

  return {
    id: card.id,
    columnId: card.columnId,
    boardId: card.boardId,
    position: card.position,
    title: card.title,
    description: card.description ?? '',
    acceptanceCriteria: parseAcceptanceCriteria(card.acceptanceCriteria),
    role: (card.role ?? 'backend-engineer') as AgentRole,
    githubRepo: card.githubRepoUrl,
    githubBranch: card.githubBranch,
    requiresApproval: card.requiresApproval,
    agentStatus: effectiveAgentStatus,
    currentAgentRunId: currentRun?.id ?? null,
    agentRuns: mappedRuns,
    canInteract: canInteract ?? true,
    revisionContextNote: card.revisionContextNote,
    approvedBy: card.approvedBy,
    approvedAt: card.approvedAt?.toISOString() ?? null,
    movedToColumnAt: card.movedToColumnAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    maxAttempts: MAX_ATTEMPTS,
    dependsOn: (card.dependsOn ?? []).map((d) => d.id),
  };
}

// ─── AgentConfig mapping ──────────────────────────────────────────────────────

export function mapAgentConfig(row: AgentConfig): AgentConfigItem {
  return {
    id: row.id,
    role: row.role,
    anthropicAgentId: row.anthropicAgentId,
    anthropicAgentVersion: row.anthropicAgentVersion,
    anthropicEnvironmentId: row.anthropicEnvironmentId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Notification mapping ────────────────────────────────────────────────────

export function mapNotification(row: {
  id: string;
  cardId: string;
  boardId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  card: { title: string };
  board: { name: string };
}): ApiNotification {
  return {
    id: row.id,
    cardId: row.cardId,
    boardId: row.boardId,
    cardTitle: row.card.title,
    boardName: row.board.name,
    type: row.type as NotificationType,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}
