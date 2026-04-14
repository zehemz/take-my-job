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
  githubRepo: string | null;
  workspacePath: string | null;
  environmentId: string | null;
  autoMode: boolean;
  createdAt: string;
  columnCount: number;
  cardCount: number;
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
  sessionId: string | null;
  retryAfterMs: number | null;
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
  canInteract: boolean;
  requiresApproval: boolean;
  revisionContextNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;  // ISO 8601
  movedToColumnAt: string | null;  // ISO 8601
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  /** Maximum agent attempts allowed, sourced from MAX_ATTEMPTS env var. */
  maxAttempts: number;
  /** IDs of cards this card depends on. Empty if no dependencies. */
  dependsOn: string[];
}

export interface ApiBoardDetail {
  board: ApiBoardSummary;
  columns: ApiColumn[];
  cards: ApiCard[];
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface CreateBoardRequest {
  name: string;
  workspacePath?: string;
  environmentId?: string;
  autoMode?: boolean;
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
  /** Card IDs this card depends on. Card won't auto-promote until all are done. */
  dependsOn?: string[];
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
  anthropicEnvironmentId: string | null;
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

// ─── Agent tools & MCP ──────────────────────────────────────────────────────

export interface AgentToolConfig {
  name: 'bash' | 'edit' | 'read' | 'write' | 'glob' | 'grep' | 'web_fetch' | 'web_search';
  enabled: boolean;
  permissionPolicy: 'always_allow' | 'always_ask';
}

export interface AgentMCPServer {
  name: string;
  url: string;
}

// ─── Agent detail ────────────────────────────────────────────────────────────

export interface AgentDetail {
  anthropicAgentId: string;
  name: string;
  model: string;
  anthropicVersion: string;
  role: string | null;
  dbId: string | null;
  syncStatus: AgentSyncStatus;
  description: string | null;
  system: string | null;
  createdAt: string;
  archivedAt: string | null;
  tools: AgentToolConfig[];
  mcpServers: AgentMCPServer[];
}

export interface PatchAgentRequest {
  name?: string;
  description?: string | null;
  model?: string;
  system?: string | null;
  role?: string;
  tools?: AgentToolConfig[];
  mcpServers?: AgentMCPServer[];
  version: number;
}

export interface PatchAgentResponse {
  agent: AgentDetail;
  newVersion: number;
}

// ─── Card reply (unblock) ─────────────────────────────────────────────────────

export interface CardReplyRequest {
  message: string;
}

// ─── Environments ────────────────────────────────────────────────────────────

export interface EnvironmentRow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  networkType: 'unrestricted' | 'limited';
}
export type EnvironmentListResponse = EnvironmentRow[]


// ─── Environment detail ──────────────────────────────────────────────────────

export interface EnvironmentNetworking {
  type: 'unrestricted' | 'limited';
  allowMcpServers?: boolean;
  allowPackageManagers?: boolean;
  allowedHosts?: string[];
}

export interface EnvironmentPackages {
  apt: string[];
  npm: string[];
  pip: string[];
  cargo: string[];
  gem: string[];
  go: string[];
}

export interface EnvironmentDetail {
  id: string;
  name: string;
  description: string;
  networking: EnvironmentNetworking;
  packages: EnvironmentPackages;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PatchEnvironmentRequest {
  name?: string;
  description?: string | null;
  networking?: EnvironmentNetworking;
  packages?: EnvironmentPackages;
}

export interface PatchEnvironmentResponse {
  environment: EnvironmentDetail;
}

// ─── Paginated response wrapper ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  nextPage: string | null;
}

// ── RBAC Admin types ──────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  githubUsername: string;
  isAdmin: boolean;
  createdAt: string;
  groups: { id: string; name: string }[];
}

export type AdminUserListResponse = AdminUserRow[];

export interface UpdateUserRequest {
  isAdmin?: boolean;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  agentRoles: string[];
  environments: string[];
  createdAt: string;
}

export type AdminGroupListResponse = AdminGroupRow[];

export interface CreateGroupRequest {
  name: string;
  description?: string;
  agentRoles: string[];
  environmentIds: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  agentRoles?: string[];
  environmentIds?: string[];
}

export interface AddGroupMemberRequest {
  userId: string;
}
