/**
 * HTTP API contract types for the Kobani Kanban board.
 *
 * These are the request/response shapes for all Next.js API routes.
 * Import from this file to stay in sync with the API — both the frontend
 * Zustand store and any external consumers should reference these types.
 */

import type { AgentRole, AgentStatus, ColumnType } from './kanban-types';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface ApiBoardSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
  /** Semantic column type derived from DB booleans + columnType field. */
  type: ColumnType;
}

export interface ApiAcceptanceCriterion {
  id: string;
  text: string;
  passed: boolean | null;
  evidence: string | null;
}

export interface ApiAgentRun {
  id: string;
  cardId: string;
  /** Column that triggered this run. */
  columnId: string | null;
  role: AgentRole;
  /** Frontend-normalized status (mapped from DB AgentRunStatus). */
  status: AgentStatus;
  attempt: number;
  startedAt: string;  // ISO 8601
  endedAt: string | null;  // ISO 8601, null if still active
  output: string;
  blockedReason: string | null;
  retryAfterMs: number | null;
  /** Anthropic Managed Agents session ID, if the run was backed by one. */
  sessionId: string | null;
  /** Internal error message recorded when the run failed. */
  error: string | null;
}

export interface ApiCard {
  id: string;
  columnId: string;
  boardId: string;
  position: number;
  title: string;
  description: string;
  acceptanceCriteria: ApiAcceptanceCriterion[];
  role: AgentRole;
  githubRepo: string | null;
  githubBranch: string | null;
  /** Derived from the most recent AgentRun for this card. */
  agentStatus: AgentStatus;
  currentAgentRunId: string | null;
  agentRuns: ApiAgentRun[];
  requiresApproval: boolean;
  revisionContextNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;  // ISO 8601
  movedToColumnAt: string | null;  // ISO 8601
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  /** Maximum agent attempts allowed, sourced from MAX_ATTEMPTS env var. */
  maxAttempts: number;
}

export interface ApiBoardDetail {
  board: ApiBoardSummary;
  columns: ApiColumn[];
  cards: ApiCard[];
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface CreateBoardRequest {
  name: string;
}

export interface CreateCardRequest {
  title: string;
  columnId: string;
  description?: string;
  acceptanceCriteria?: ApiAcceptanceCriterion[];
  role?: AgentRole;
  position?: number;
  githubRepo?: string;
  githubBranch?: string;
  requiresApproval?: boolean;
}

export interface RequestRevisionRequest {
  reason: string;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  acceptanceCriteria?: ApiAcceptanceCriterion[];
  role?: AgentRole;
  githubRepo?: string;
  githubBranch?: string;
  revisionContextNote?: string;
  approvedBy?: string;
}

export interface MoveCardRequest {
  columnId: string;
  position?: number;
}

// ─── SSE event types (mirrored from lib/types.ts BroadcastEvent) ──────────────
// The SSE endpoint at GET /api/events/[cardId] streams these as JSON-encoded
// `data:` lines in the text/event-stream format.

export type SseEvent =
  | { type: 'agent_message'; text: string }
  | { type: 'agent_thinking'; thinking: string }
  | { type: 'tool_use'; tool_name: string; input: unknown }
  | { type: 'card_update'; status: string; summary: string; next_column?: string }
  | { type: 'card_blocked'; reason: string; session_id: string; cli_command: string }
  | { type: 'status_change'; status: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

// ─── Common error shape ───────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface AgentConfigItem {
  id: string;
  role: string;
  anthropicAgentId: string;
  anthropicAgentVersion: string;
  anthropicEnvironmentId: string;
  createdAt: string; // ISO-8601
}

export type AgentConfigListResponse = AgentConfigItem[]

export type AgentSyncStatus = 'healthy' | 'unmapped' | 'orphaned'

export interface AgentRow {
  // From Anthropic (live)
  anthropicAgentId: string
  name: string
  model: string
  anthropicVersion: string
  // From DB (role mapping)
  role: string | null       // null = unmapped (exists on Anthropic, no DB record)
  dbId: string | null       // AgentConfig.id, null if unmapped
  // Derived
  syncStatus: AgentSyncStatus
}

export type AgentListResponse = AgentRow[]

export type SessionStatus = 'rescheduling' | 'running' | 'idle' | 'terminated';

export interface SessionRow {
  id: string;
  title: string | null;
  status: SessionStatus;
  agentName: string;
  agentId: string;
  environmentId: string;
  createdAt: string;
  updatedAt: string;
  cardId: string | null;
  boardId: string | null;
  agentRole: string | null;
  agentRunStatus: string | null;
}

export type SessionListResponse = SessionRow[];

// ─── Notification types ─────────────────────────────────────────────────────

export type NotificationType = 'blocked' | 'evaluation-failed' | 'pending-approval' | 'failed';

export interface ApiNotification {
  id: string;
  cardId: string;
  boardId: string;
  cardTitle: string;
  boardName: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO 8601
}

export interface NotificationsResponse {
  notifications: ApiNotification[];
  unreadCount: number;
}

export interface MarkNotificationsReadRequest {
  notificationIds: string[]; // empty array = mark ALL read
}
