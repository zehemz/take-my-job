import type { KobaniStore } from './kanban-types';

// Use fixed timestamps relative to "now" (seeded at build time for SSR consistency)
// We use fixed ISO strings; the seed is treated as "static"
const NOW = '2026-04-13T10:00:00.000Z';
const MINUS_10M = '2026-04-13T09:50:00.000Z';
const MINUS_1H30M = '2026-04-13T08:30:00.000Z'; // > 1 hour ago → URGENT
const MINUS_2H = '2026-04-13T08:00:00.000Z';
const MINUS_3H = '2026-04-13T07:00:00.000Z';
const MINUS_1D = '2026-04-12T10:00:00.000Z';
const MINUS_2D = '2026-04-11T10:00:00.000Z';

export const initialState: KobaniStore = {
  boards: [
    { id: 'board-1', name: 'Sprint 12 Board', createdAt: MINUS_2D, githubRepo: null, workspacePath: null },
    { id: 'board-2', name: 'Content Pipeline', createdAt: MINUS_2D, githubRepo: null, workspacePath: null },
    { id: 'board-3', name: 'Platform Docs', createdAt: MINUS_1D, githubRepo: null, workspacePath: null },
  ],

  columns: [
    // Board 1 — Sprint 12 Board
    { id: 'col-1-1', boardId: 'board-1', name: 'Backlog', type: 'inactive', position: 0 },
    { id: 'col-1-2', boardId: 'board-1', name: 'In Progress', type: 'active', position: 1 },
    { id: 'col-1-3', boardId: 'board-1', name: 'Review', type: 'review', position: 2 },
    { id: 'col-1-4', boardId: 'board-1', name: 'Revision Needed', type: 'revision', position: 3 },
    { id: 'col-1-5', boardId: 'board-1', name: 'Done', type: 'terminal', position: 4 },

    // Board 2 — Content Pipeline
    { id: 'col-2-1', boardId: 'board-2', name: 'Backlog', type: 'inactive', position: 0 },
    { id: 'col-2-2', boardId: 'board-2', name: 'Drafting', type: 'active', position: 1 },
    { id: 'col-2-3', boardId: 'board-2', name: 'Revision Needed', type: 'revision', position: 2 },
    { id: 'col-2-4', boardId: 'board-2', name: 'Published', type: 'terminal', position: 3 },

    // Board 3 — Platform Docs
    { id: 'col-3-1', boardId: 'board-3', name: 'Backlog', type: 'inactive', position: 0 },
    { id: 'col-3-2', boardId: 'board-3', name: 'In Progress', type: 'active', position: 1 },
    { id: 'col-3-3', boardId: 'board-3', name: 'Review', type: 'review', position: 2 },
    { id: 'col-3-4', boardId: 'board-3', name: 'Published', type: 'terminal', position: 3 },
  ],

  cards: [
    // === BOARD 1 ===

    // 1. idle — in Backlog, no AgentRun
    {
      id: 'card-1-1',
      columnId: 'col-1-1',
      boardId: 'board-1',
      position: 0,
      title: 'API rate limit documentation',
      description: 'Document all rate limit headers, retry-after semantics, and per-endpoint caps.',
      acceptanceCriteria: [
        { id: 'ac-1-1-1', text: 'All endpoints list their rate limits', passed: null, evidence: null },
        { id: 'ac-1-1-2', text: 'Retry-after header semantics are explained', passed: null, evidence: null },
        { id: 'ac-1-1-3', text: 'Example request/response pairs included', passed: null, evidence: null },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: null,
      agentStatus: 'idle',
      currentAgentRunId: null,
      agentRuns: [],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_1D,
      movedToColumnAt: MINUS_1D,
    },

    // 2. running — Auth flow redesign in In Progress
    {
      id: 'card-1-2',
      columnId: 'col-1-2',
      boardId: 'board-1',
      position: 0,
      title: 'Auth flow redesign',
      description: 'Redesign the authentication flow to support OAuth2, magic links, and TOTP.',
      acceptanceCriteria: [
        { id: 'ac-1-2-1', text: 'OAuth2 provider integration passes integration tests', passed: null, evidence: null },
        { id: 'ac-1-2-2', text: 'Magic link expiry is 15 minutes', passed: null, evidence: null },
        { id: 'ac-1-2-3', text: 'TOTP setup flow documented in README', passed: null, evidence: null },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: 'feat/auth-redesign',
      agentStatus: 'running',
      currentAgentRunId: 'run-1-2-1',
      agentRuns: [
        {
          id: 'run-1-2-1',
          cardId: 'card-1-2',
          role: 'backend-engineer',
          status: 'running',
          attempt: 1,
          startedAt: MINUS_10M,
          endedAt: null,
          output: `# Auth Flow Redesign — Attempt 1

## Phase 1: Project Analysis

Reading existing auth implementation...

\`\`\`
src/auth/
  ├── passport.ts        ✓ read
  ├── session.ts         ✓ read
  └── middleware.ts      ✓ read
\`\`\`

Identified issues:
- Session store uses in-memory; needs Redis for horizontal scaling
- No PKCE support in current OAuth flow
- Magic link token is stored in plain text in DB

## Phase 2: OAuth2 Integration

Installing dependencies...
\`\`\`bash
npm install passport-oauth2 openid-client
\`\`\`

Writing OAuth2 strategy...`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_10M,
      movedToColumnAt: MINUS_10M,
    },

    // 3. blocked — Database connection pooling
    {
      id: 'card-1-3',
      columnId: 'col-1-2',
      boardId: 'board-1',
      position: 1,
      title: 'Database connection pooling',
      description: 'Implement PgBouncer connection pooling in front of the primary Postgres instance.',
      acceptanceCriteria: [
        { id: 'ac-1-3-1', text: 'PgBouncer config checked into infra repo', passed: null, evidence: null },
        { id: 'ac-1-3-2', text: 'Load test shows < 5ms p99 connection acquisition', passed: null, evidence: null },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/infra',
      githubBranch: 'feat/pgbouncer',
      agentStatus: 'blocked',
      currentAgentRunId: 'run-1-3-1',
      agentRuns: [
        {
          id: 'run-1-3-1',
          cardId: 'card-1-3',
          role: 'backend-engineer',
          status: 'blocked',
          attempt: 1,
          startedAt: MINUS_1H30M,
          endedAt: null,
          output: `# Database Connection Pooling

## Analysis

Cloned infra repo and reviewed current setup.

Current connection handling:
- Max connections per app server: 20
- No pooler in front of Postgres
- 3 app servers × 20 = 60 connections (Postgres max_connections: 100)

## Blocked

I need to know the target environment for PgBouncer deployment.`,
          blockedReason: 'I need to know whether PgBouncer should be deployed as a sidecar container alongside each app server instance, or as a standalone service in the shared infra VPC. This decision affects the configuration for `listen_addr`, TLS setup, and how app servers discover the pooler. Please clarify the deployment topology before I proceed.',
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_1H30M,
      movedToColumnAt: MINUS_1H30M,
    },

    // 4. failed — Rate limiter middleware
    {
      id: 'card-1-4',
      columnId: 'col-1-2',
      boardId: 'board-1',
      position: 2,
      title: 'Rate limiter middleware',
      description: 'Implement sliding window rate limiting middleware using Redis.',
      acceptanceCriteria: [
        { id: 'ac-1-4-1', text: 'Sliding window algorithm implemented correctly', passed: null, evidence: null },
        { id: 'ac-1-4-2', text: 'Unit tests cover edge cases (burst, exact limit)', passed: null, evidence: null },
        { id: 'ac-1-4-3', text: 'Middleware returns 429 with Retry-After header', passed: null, evidence: null },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: 'feat/rate-limiter',
      agentStatus: 'failed',
      currentAgentRunId: 'run-1-4-2',
      agentRuns: [
        {
          id: 'run-1-4-1',
          cardId: 'card-1-4',
          role: 'backend-engineer',
          status: 'failed',
          attempt: 1,
          startedAt: MINUS_3H,
          endedAt: MINUS_2H,
          output: `# Rate Limiter Middleware — Attempt 1

Installing ioredis...
Writing sliding window implementation...

ERROR: Redis connection refused at localhost:6379
Could not proceed without Redis. Failing.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
        {
          id: 'run-1-4-2',
          cardId: 'card-1-4',
          role: 'backend-engineer',
          status: 'failed',
          attempt: 2,
          startedAt: MINUS_1H30M,
          endedAt: MINUS_1H30M,
          output: `# Rate Limiter Middleware — Attempt 2

Retrying with mocked Redis in test environment...

Writing implementation...
Running tests...

FAIL src/__tests__/rateLimiter.test.ts
  ● sliding window › should reject at exact limit
    Expected 429, received 200

Test suite failed.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: 38000,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_1H30M,
      movedToColumnAt: MINUS_2D,
    },

    // 5. evaluating — JWT refresh endpoint in Review
    {
      id: 'card-1-5',
      columnId: 'col-1-3',
      boardId: 'board-1',
      position: 0,
      title: 'JWT refresh endpoint',
      description: 'Implement /auth/refresh that rotates the JWT access token using a refresh token.',
      acceptanceCriteria: [
        { id: 'ac-1-5-1', text: 'Refresh token is rotated on each use (one-time-use)', passed: null, evidence: null },
        { id: 'ac-1-5-2', text: 'Expired refresh token returns 401', passed: null, evidence: null },
        { id: 'ac-1-5-3', text: 'New access token has 15-minute TTL', passed: null, evidence: null },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: 'feat/jwt-refresh',
      agentStatus: 'evaluating',
      currentAgentRunId: 'run-1-5-1',
      agentRuns: [
        {
          id: 'run-1-5-1',
          cardId: 'card-1-5',
          role: 'qa-engineer',
          status: 'evaluating',
          attempt: 1,
          startedAt: MINUS_10M,
          endedAt: null,
          output: `# JWT Refresh Endpoint — Evaluation

Running acceptance criteria checks...

[1/3] Checking refresh token rotation...
[2/3] Checking expired token response...
[3/3] Checking access token TTL...`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_10M,
      movedToColumnAt: MINUS_10M,
    },

    // 6. evaluation-failed — Remove legacy session cookie in Revision Needed
    {
      id: 'card-1-6',
      columnId: 'col-1-4',
      boardId: 'board-1',
      position: 0,
      title: 'Remove legacy session cookie',
      description: 'Remove the legacy `sid` session cookie and all related middleware.',
      acceptanceCriteria: [
        { id: 'ac-1-6-1', text: 'No references to `sid` cookie in codebase', passed: true, evidence: 'grep -r "sid" src/ returned 0 results' },
        { id: 'ac-1-6-2', text: 'Session middleware removed from Express app', passed: true, evidence: 'app.ts: express-session import removed' },
        { id: 'ac-1-6-3', text: 'No regressions in existing auth tests', passed: false, evidence: '3 tests failing: session.test.ts:42, session.test.ts:67, auth.integration.test.ts:112' },
        { id: 'ac-1-6-4', text: 'Cookie cleared from browser on next login', passed: false, evidence: 'Cookie "sid" still present in Set-Cookie header on /auth/login response' },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: 'feat/remove-session-cookie',
      agentStatus: 'evaluation-failed',
      currentAgentRunId: 'run-1-6-1',
      agentRuns: [
        {
          id: 'run-1-6-1',
          cardId: 'card-1-6',
          role: 'qa-engineer',
          status: 'evaluation-failed',
          attempt: 1,
          startedAt: MINUS_3H,
          endedAt: MINUS_2H,
          output: `# Remove Legacy Session Cookie — Evaluation

## Results

✓ No references to \`sid\` cookie found (grep returned 0)
✓ express-session middleware removed from app.ts
✗ 3 existing auth tests are now failing
✗ Set-Cookie header still sets \`sid\` in /auth/login

## Summary

2/4 criteria passed. 2 criteria failed. Sending to Revision Needed.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_2H,
      movedToColumnAt: MINUS_2H,
    },

    // 7. pending-approval — Onboarding copy update in Review (board 1)
    {
      id: 'card-1-7',
      columnId: 'col-1-3',
      boardId: 'board-1',
      position: 1,
      title: 'Onboarding copy update',
      description: 'Rewrite the onboarding flow copy to match the new brand voice guidelines.',
      acceptanceCriteria: [
        { id: 'ac-1-7-1', text: 'All 5 onboarding screens have updated copy', passed: true, evidence: 'All 5 screens reviewed: welcome, profile, team, billing, done' },
        { id: 'ac-1-7-2', text: 'Copy reviewed against brand voice checklist', passed: true, evidence: 'Brand voice score: 94/100 — approved by content style guide v3' },
        { id: 'ac-1-7-3', text: 'No placeholder text (lorem ipsum) in any screen', passed: true, evidence: 'grep -r "lorem" src/copy/ returned 0 results' },
      ],
      role: 'content-writer',
      assignee: 'Lucas Bais',
      githubRepo: null,
      githubBranch: null,
      agentStatus: 'pending-approval',
      currentAgentRunId: 'run-1-7-1',
      agentRuns: [
        {
          id: 'run-1-7-1',
          cardId: 'card-1-7',
          role: 'content-writer',
          status: 'pending-approval',
          attempt: 1,
          startedAt: MINUS_3H,
          endedAt: MINUS_1H30M,
          output: `# Onboarding Copy Update

## Completed

All 5 onboarding screens rewritten with new brand voice.

### Changes made:
- Welcome screen: personalized greeting with user name interpolation
- Profile screen: reduced copy from 120 to 47 words
- Team screen: added social proof ("Join 50,000+ teams")
- Billing screen: simplified pricing table description
- Done screen: celebration message with next-step CTA

All acceptance criteria passed. Awaiting human approval.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_1H30M,
      movedToColumnAt: MINUS_1H30M,
    },

    // 8. completed — Remove deprecated endpoints in Done
    {
      id: 'card-1-8',
      columnId: 'col-1-5',
      boardId: 'board-1',
      position: 0,
      title: 'Remove deprecated endpoints',
      description: 'Remove /v1/users/list and /v1/users/get endpoints deprecated in v2.',
      acceptanceCriteria: [
        { id: 'ac-1-8-1', text: 'Deprecated endpoints return 410 Gone', passed: true, evidence: 'curl /v1/users/list → 410 Gone confirmed' },
        { id: 'ac-1-8-2', text: 'No internal callers of deprecated endpoints', passed: true, evidence: 'Code search found 0 internal references' },
        { id: 'ac-1-8-3', text: 'API changelog updated', passed: true, evidence: 'CHANGELOG.md entry added under v2.4.0' },
      ],
      role: 'backend-engineer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/api',
      githubBranch: 'feat/remove-deprecated-v1',
      agentStatus: 'completed',
      currentAgentRunId: 'run-1-8-1',
      agentRuns: [
        {
          id: 'run-1-8-1',
          cardId: 'card-1-8',
          role: 'backend-engineer',
          status: 'completed',
          attempt: 1,
          startedAt: MINUS_2D,
          endedAt: MINUS_1D,
          output: `# Remove Deprecated Endpoints — Completed

## Summary

Removed /v1/users/list and /v1/users/get.
Both endpoints now return 410 Gone.
Internal callers: 0 found.
CHANGELOG.md updated.

All acceptance criteria passed. Work complete.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: '@lucas',
      approvedAt: MINUS_1D,
      createdAt: MINUS_2D,
      updatedAt: MINUS_1D,
      movedToColumnAt: MINUS_1D,
    },

    // === BOARD 2 ===

    // evaluation-failed — Onboarding copy update (Content Pipeline)
    {
      id: 'card-2-1',
      columnId: 'col-2-3',
      boardId: 'board-2',
      position: 0,
      title: 'Onboarding copy update',
      description: 'Rewrite onboarding copy for the content marketing platform.',
      acceptanceCriteria: [
        { id: 'ac-2-1-1', text: 'Tone matches upbeat-professional brand voice', passed: false, evidence: 'Tone analysis: detected formal/corporate. Expected: conversational. Mismatch on screens 2, 3, 5.' },
        { id: 'ac-2-1-2', text: 'Each onboarding step has a clear CTA button', passed: false, evidence: 'Step 3 "Team setup" is missing CTA — only has a Skip link.' },
        { id: 'ac-2-1-3', text: 'Copy reviewed by brand style guide v3', passed: true, evidence: 'Style guide checklist complete.' },
      ],
      role: 'content-writer',
      assignee: 'Lucas Bais',
      githubRepo: null,
      githubBranch: null,
      agentStatus: 'evaluation-failed',
      currentAgentRunId: 'run-2-1-1',
      agentRuns: [
        {
          id: 'run-2-1-1',
          cardId: 'card-2-1',
          role: 'qa-engineer',
          status: 'evaluation-failed',
          attempt: 1,
          startedAt: MINUS_3H,
          endedAt: MINUS_2H,
          output: `# Onboarding Copy — Evaluation

✗ Tone mismatch detected on screens 2, 3, 5
✗ Missing CTA on step 3 "Team setup"
✓ Brand style guide checklist passed

2 criteria failed. Sending to Revision Needed.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_2D,
      updatedAt: MINUS_2H,
      movedToColumnAt: MINUS_2H,
    },

    // running — Blog post: AI in devtools
    {
      id: 'card-2-2',
      columnId: 'col-2-2',
      boardId: 'board-2',
      position: 0,
      title: 'Blog post: AI in devtools',
      description: 'Write a 1500-word blog post on how AI is changing developer tooling in 2026.',
      acceptanceCriteria: [
        { id: 'ac-2-2-1', text: '1400–1600 words', passed: null, evidence: null },
        { id: 'ac-2-2-2', text: 'Includes at least 3 concrete examples', passed: null, evidence: null },
        { id: 'ac-2-2-3', text: 'Ends with a CTA linking to Kobani', passed: null, evidence: null },
      ],
      role: 'content-writer',
      assignee: 'Lucas Bais',
      githubRepo: null,
      githubBranch: null,
      agentStatus: 'running',
      currentAgentRunId: 'run-2-2-1',
      agentRuns: [
        {
          id: 'run-2-2-1',
          cardId: 'card-2-2',
          role: 'content-writer',
          status: 'running',
          attempt: 1,
          startedAt: MINUS_10M,
          endedAt: null,
          output: `# Blog Post: AI in Devtools — Draft

## Introduction

The developer toolkit has always been a reflection of the era. In the 1990s, IDEs emerged to replace text editors. In the 2000s, version control became non-negotiable. In the 2010s, CI/CD pipelines normalized automated testing. In 2026, AI agents are doing the same — but faster and more disruptively than any shift before them.

## The Shift Is Already Here

Three trends are converging to make AI an indispensable part of the dev stack:

**1. Ambient code generation**
Tools like GitHub Copilot and Cursor have normalized the idea that the IDE suggests code as you type. But the next wave goes further...`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_1D,
      updatedAt: MINUS_10M,
      movedToColumnAt: MINUS_10M,
    },

    // idle — Q2 release notes
    {
      id: 'card-2-3',
      columnId: 'col-2-1',
      boardId: 'board-2',
      position: 0,
      title: 'Q2 release notes',
      description: 'Write Q2 release notes covering all shipped features and bug fixes.',
      acceptanceCriteria: [
        { id: 'ac-2-3-1', text: 'All shipped features listed', passed: null, evidence: null },
        { id: 'ac-2-3-2', text: 'Breaking changes highlighted', passed: null, evidence: null },
      ],
      role: 'content-writer',
      assignee: 'Lucas Bais',
      githubRepo: null,
      githubBranch: null,
      agentStatus: 'idle',
      currentAgentRunId: null,
      agentRuns: [],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_1D,
      updatedAt: MINUS_1D,
      movedToColumnAt: MINUS_1D,
    },

    // === BOARD 3 ===

    // pending-approval — API rate limit documentation in Review
    {
      id: 'card-3-1',
      columnId: 'col-3-3',
      boardId: 'board-3',
      position: 0,
      title: 'API rate limit documentation',
      description: 'Write full reference documentation for Kobani API rate limiting.',
      acceptanceCriteria: [
        { id: 'ac-3-1-1', text: 'All endpoints list rate limit headers', passed: true, evidence: 'Docs verified: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset present for all 23 endpoints.' },
        { id: 'ac-3-1-2', text: 'Retry-after semantics documented with examples', passed: true, evidence: '3 code examples added: curl, Node.js, Python. All correct.' },
        { id: 'ac-3-1-3', text: 'Error response schema for 429 documented', passed: true, evidence: 'JSON schema and prose description verified against actual API behavior.' },
      ],
      role: 'product-spec-writer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/docs',
      githubBranch: 'docs/rate-limits',
      agentStatus: 'pending-approval',
      currentAgentRunId: 'run-3-1-1',
      agentRuns: [
        {
          id: 'run-3-1-1',
          cardId: 'card-3-1',
          role: 'product-spec-writer',
          status: 'pending-approval',
          attempt: 1,
          startedAt: MINUS_3H,
          endedAt: MINUS_1H30M,
          output: `# API Rate Limit Documentation

## Completed

All 23 API endpoints documented with rate limit headers.
Retry-after examples in curl, Node.js, and Python added.
429 error schema documented and verified.

All 3 acceptance criteria passed. Awaiting human approval.`,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_1D,
      updatedAt: MINUS_1H30M,
      movedToColumnAt: MINUS_1H30M,
    },

    // running — SDK quickstart guide
    {
      id: 'card-3-2',
      columnId: 'col-3-2',
      boardId: 'board-3',
      position: 0,
      title: 'SDK quickstart guide',
      description: 'Write a 10-minute quickstart guide for the Kobani Node.js SDK.',
      acceptanceCriteria: [
        { id: 'ac-3-2-1', text: 'Covers install, auth, first API call, and error handling', passed: null, evidence: null },
        { id: 'ac-3-2-2', text: 'Code samples are runnable with npm install + node index.js', passed: null, evidence: null },
      ],
      role: 'product-spec-writer',
      assignee: 'Lucas Bais',
      githubRepo: 'kobani/docs',
      githubBranch: 'docs/sdk-quickstart',
      agentStatus: 'running',
      currentAgentRunId: 'run-3-2-1',
      agentRuns: [
        {
          id: 'run-3-2-1',
          cardId: 'card-3-2',
          role: 'product-spec-writer',
          status: 'running',
          attempt: 1,
          startedAt: MINUS_10M,
          endedAt: null,
          output: `# SDK Quickstart Guide — Draft

## Installation

\`\`\`bash
npm install @kobani/sdk
\`\`\`

## Authentication

The SDK authenticates using an API key. Generate one from your Kobani dashboard.

\`\`\`javascript
const { KobaniClient } = require('@kobani/sdk');

const client = new KobaniClient({
  apiKey: process.env.KOBANI_API_KEY,
});
\`\`\`

## Your First API Call

\`\`\`javascript
const boards = await client.boards.list();
console.log(boards);
\`\`\``,
          blockedReason: null,
          sessionId: null,
          retryAfterMs: null,
          error: null,
        },
      ],
      requiresApproval: false,
      revisionContextNote: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: MINUS_1D,
      updatedAt: MINUS_10M,
      movedToColumnAt: MINUS_10M,
    },
  ],

  agentRuns: [], // AgentRuns are embedded in cards; this top-level array is kept for store convenience
};
