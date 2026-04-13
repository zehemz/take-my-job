# Kobani — Product Requirements Document

> This document defines **what** Kobani must do and **for whom**, organized into shippable milestones. It sits above [SPEC.md](./SPEC.md), which defines the technical contracts a conforming implementation must satisfy. When the two conflict, the PRD reflects the product intent and SPEC.md should be updated to match.

---

## Vision

Kobani is the work surface for the entire product organization. Any team member — developer, engineering manager, product owner, content writer, or designer — manages their work through a familiar Kanban board. AI agents are dispatched automatically when a card enters an active column, doing the execution work so that humans can focus on decisions, direction, and review.

**Core promise:** move a card, get work done.

---

## Personas

| Persona | Primary goal on the board | Interacts with agents? |
|---|---|---|
| **Developer** | Ship features, fix bugs, write tests | Yes — coding, review, QA agents |
| **Engineering Manager** | Track team progress, unblock work | Indirectly — monitors, reassigns |
| **Product Owner** | Define requirements, prioritize backlog | Yes — spec/requirements agents |
| **Content Writer** | Draft and iterate on copy | Yes — content agents |
| **Designer** | Produce design specs, component briefs | Yes — design-spec agents |

---

## Milestones

---

### Milestone 1 — Foundation
**Shippable as:** Internal dev tool for engineering teams.

The core loop: a developer creates a card, moves it to an active column, an agent does the work, and the card moves itself to Done.

#### 1.1 Kanban Board

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1.1.1 | Users can create, rename, and delete boards | A board requires a name. Deleting a board deletes all its columns and cards. |
| 1.1.2 | Users can add, rename, reorder, and delete columns | Columns have a display name and a left-to-right position. Each column has one of four types: **Inactive** (default), **Active** (dispatches work agent on card entry), **Review** (dispatches evaluation agent on card entry, then requires human sign-off), or **Revision** (no dispatch; holds cards that failed evaluation, awaiting human action). A conforming board must have at least one Active column, one Review column, one Revision column, and one Terminal column. |
| 1.1.3 | Users can create cards with a title, description, and acceptance criteria | Description and acceptance criteria are optional at creation. |
| 1.1.4 | Users can drag cards between columns | Drag-and-drop is the primary interaction. A card move is atomic — it either succeeds fully or reverts. |
| 1.1.5 | Cards display their current agent status inline | Status badge shows: idle · running · blocked · failed (with retry countdown) · evaluating · evaluation failed (N criteria) · pending approval · completed. |
| 1.1.6 | Cards are ordered within a column and can be reordered by drag | Position is persisted. |

#### 1.2 Agent Dispatch

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1.2.1 | Moving a card into an active column automatically dispatches an agent | Dispatch happens without any user action beyond the card move. |
| 1.2.2 | The system supports three built-in agent roles: Backend Engineer, QA Engineer, Tech Lead | Each role has a distinct system prompt and set of tools. |
| 1.2.3 | A card can be assigned a specific role before dispatch | If no role is set, the system uses a default role. |
| 1.2.4 | Only one agent runs per card at a time | A second move into an active column is a no-op if an agent is already running for that card. |
| 1.2.5 | The system enforces a concurrency cap across all running agents | Default cap is 5. Cards exceeding the cap are queued and dispatched when a slot opens. |
| 1.2.6 | A card can optionally reference a GitHub repository and branch | When set, the agent session mounts that repository at startup. |

#### 1.3 Real-Time Output

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1.3.1 | Agent output streams to the card in real time | Output appears incrementally as the agent produces it, without a page refresh. |
| 1.3.2 | Output is rendered as Markdown | Code blocks, lists, and headings are formatted correctly. |
| 1.3.3 | Output is persistent | Navigating away and returning shows the full accumulated output. |
| 1.3.4 | When an agent completes, the card moves to the designated next column automatically | No user action required. |

#### 1.5 Acceptance Criteria Gating & Evaluation

A card cannot advance past a Review column unless every acceptance criterion is verified. This section defines the full evaluation loop.

**Column roles in the evaluation loop:**

| Column type | Agent dispatched | Advances when |
|---|---|---|
| Active | Work agent (card's assigned role) | Agent calls `update_card(completed)` with all criteria passed |
| Review | Evaluation agent (QA role) | All criteria pass evaluation AND human signs off |
| Revision | None | Human manually moves card back to Active |
| Terminal | None | Final state |

**Requirements:**

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1.5.1 | A card with acceptance criteria cannot leave an Active column unless every criterion is marked `passed: true` | The Agent Runner rejects any `update_card(completed)` call where one or more `criteria_results` entries have `passed: false`. The agent is asked to fix the failing criterion before calling again. |
| 1.5.2 | When a card enters a Review column, an evaluation agent is automatically dispatched | The evaluation agent receives: card title, description, all acceptance criteria, and the full output of the prior work agent as context. |
| 1.5.3 | The evaluation agent produces a pass/fail verdict with evidence for each criterion | Evidence is a short, specific string (e.g. file path + line, test output excerpt). Vague evidence is not accepted. |
| 1.5.4 | If the evaluation agent finds all criteria passing, the card enters a "Pending Approval" state | The card does not auto-advance. An in-app notification is sent to the assignee requesting sign-off. |
| 1.5.5 | A human reviewer must explicitly approve the card before it moves to the Terminal column | The approve action records `approvedBy` and `approvedAt` on the card. |
| 1.5.6 | A reviewer can reject an otherwise-passing evaluation and request a revision | Rejection requires a written reason, which is attached to the card and injected into the next agent's context. |
| 1.5.7 | If the evaluation agent finds any criterion failing, the card moves to the Revision column automatically | No human action required to trigger the move. |
| 1.5.8 | The card in the Revision column shows a full evaluation report: per-criterion pass/fail with evidence | The report is always visible without expansion. |
| 1.5.9 | Before sending a card back to In Progress from the Revision column, the assignee can optionally add a context note | The note is prepended to the next work agent's prompt under a `## Revision Context` heading alongside the evaluation failure report. |
| 1.5.10 | Moving a card from Revision back to an Active column triggers a fresh agent dispatch | The new agent is aware it is working on a revision: it receives the previous evaluation failure report and any human context note. |

#### 1.6 Failure & Retry

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1.6.1 | Failed agent runs are retried automatically with exponential backoff | Up to 5 attempts. Backoff sequence: 10s, 20s, 40s, 80s, 300s cap. |
| 1.6.2 | The card displays the current attempt number and next retry time when in a failed state | Users can see retry progress without digging into logs. |
| 1.6.3 | Users can manually cancel a running agent by moving the card to a terminal column | Cancellation interrupts the session immediately. |

---

### Milestone 2 — Collaboration
**Shippable as:** Team tool — multiple people working the same board simultaneously.

#### 2.1 Multi-User Presence

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 2.1.1 | Multiple users can view and interact with the same board concurrently | Card moves and updates from one user appear on other users' screens without a refresh. |
| 2.1.2 | Cards show which user moved them last | Attribution is displayed as a small avatar or name on the card. |
| 2.1.3 | Conflicting simultaneous moves are resolved deterministically | Last-write-wins with optimistic UI rollback on conflict. |

#### 2.2 Identity & Assignment

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 2.2.1 | Users have accounts with a display name and avatar | Authentication is required to interact with any board. |
| 2.2.2 | Cards can be assigned to a specific user | Assignee is shown on the card face. |
| 2.2.3 | Users can filter the board to show only cards assigned to them | Filter persists for the session. |

#### 2.3 Role-Based Permissions

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 2.3.1 | Board members have one of three roles: Viewer, Contributor, Admin | Viewers cannot move cards. Contributors can create and move cards. Admins can configure columns and board settings. |
| 2.3.2 | Only Admins can mark a column as active or terminal | Prevents accidental dispatch configuration changes. |
| 2.3.3 | Board membership is invite-based | A user must be invited to access a board. |

#### 2.4 Extended Agent Roles

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 2.4.1 | The system supports two additional built-in agent roles: Content Writer and Product Spec Writer | Each has a role-appropriate system prompt. Content Writer produces drafts and copy. Product Spec Writer produces requirements and user stories. |
| 2.4.2 | Board admins can create custom agent roles with a name and system prompt | Custom roles are available for card assignment on that board. |
| 2.4.3 | A Designer role is supported, producing structured design briefs and component specifications | Brief format is Markdown; includes proposed component names, interaction states, and copy. |

---

### Milestone 3 — Attention & Human-in-the-Loop
**Shippable as:** Full org-ready tool — agents surface blockers to humans and humans can respond without leaving Kobani.

This milestone directly addresses the core human-in-the-loop requirement: when an agent cannot proceed, the right person is notified and can respond through the tool.

#### 3.1 Notifications

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 3.1.1 | When an agent moves a card to `blocked`, the card's assignee is notified immediately | Notification is delivered in-app. |
| 3.1.2 | When an evaluation fails, the card's assignee is notified with a summary of failing criteria | Notification includes: card title, number of criteria failed, and a link directly to the evaluation report. |
| 3.1.3 | When an evaluation passes and human sign-off is required, the assignee is notified | Notification reads: "Evaluation passed on [card] — your approval is needed." |
| 3.1.4 | Notifications appear in a persistent inbox accessible from any board | Unread count is shown in the navigation. |
| 3.1.5 | Each notification links directly to the relevant card and state | One click takes the user to the card with the actionable state visible. |
| 3.1.6 | Users can configure notification delivery channels | Supported channels: in-app (required), email (optional), Slack (optional). |
| 3.1.7 | Notifications are also sent for: agent failed after all retries, agent completed, card assigned to user | Each is separately toggleable per user. |

#### 3.2 Responding to a Blocked Agent

Users have two ways to respond when an agent is blocked. Both must be available.

**Option A — Ticket Update (in Kobani)**

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 3.2.1 | A blocked card shows a prominent "Blocked" badge and the agent's stated reason | Reason is shown in full without requiring expansion. |
| 3.2.2 | Users can type and send a message to the blocked agent directly from the card | The message is delivered to the live session. The agent's response streams back to the card in real time. |
| 3.2.3 | The conversation thread between the user and the agent is shown in order on the card | Each message is attributed (user or agent) with a timestamp. |
| 3.2.4 | When the agent resumes after a user message, the blocked badge clears automatically | No manual status reset required. |

#### 3.3 Attention Queue

The Attention Queue surfaces all cards that require a human decision, across all boards, in one place. Three states qualify for the queue:

| State | Trigger | Required human action |
|---|---|---|
| **Blocked** | Agent called `update_card(blocked)` | Reply via card message |
| **Revision Needed** | Evaluation agent found failing criteria | Review report, optionally add context, send back to In Progress |
| **Pending Approval** | Evaluation passed, sign-off required | Approve or request revision |

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 3.3.1 | A dedicated "Needs Attention" view shows all cards in the above three states assigned to the current user, across all boards | Sorted by time in state, oldest first. |
| 3.3.2 | Each entry shows: card title, board, column, state, reason or summary, time in state | Users can take the primary action directly from this view without navigating to the board. |
| 3.3.3 | Cards that have been in a Blocked or Revision Needed state for more than 1 hour are visually escalated | Escalation styling is distinct (e.g. red border, "URGENT" badge). |
| 3.3.4 | The queue is grouped by state type: Blocked · Revision Needed · Pending Approval | Within each group, oldest first. |
| 3.3.5 | The queue is accessible from a persistent navigation item visible on all boards | Unresolved count is shown as a badge on the nav item. |

---

### Milestone 4 — Observability & Management
**Shippable as:** Tool suitable for Engineering Managers and Product Owners tracking org-wide work.

#### 4.1 Card History

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 4.1.1 | Every card has a full audit trail: column moves, agent runs, user messages, status changes | History is ordered chronologically and always visible. |
| 4.1.2 | Each AgentRun in the history shows: role, attempt number, status, duration, and full output | Output is collapsible. |

#### 4.2 Board-Level Metrics

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 4.2.1 | Boards show a summary of active agents: how many running, how many blocked, how many queued | Summary is visible without leaving the board view. |
| 4.2.2 | Cards show how long they have been in their current column | Displayed as a relative time (e.g. "3h in Review"). |
| 4.2.3 | Engineering Managers can see cycle time per card: time from first active column entry to terminal column | Available as a sortable column in a list view of cards. |

#### 4.3 Search & Filter

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 4.3.1 | Users can search cards by title and description across all boards they have access to | Search is instant (client-side or debounced, <300ms). |
| 4.3.2 | Users can filter cards by: assignee, role, agent status, column | Filters are combinable. |

#### 4.4 Skill Observability

Every agent invocation emits a structured record of each tool call it makes. This data is stored alongside the AgentRun and surfaced at both the card and board level.

**Definitions:**
- A **skill invocation** is a single tool call made by an agent: the tool name, the inputs supplied, the output received, and the wall-clock duration.
- A **skill trace** is the ordered sequence of all skill invocations for one AgentRun.

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 4.4.1 | Every AgentRun records a full skill trace: tool name, inputs, outputs, duration, and invocation order | Trace is stored even if the run fails or is cancelled. Inputs and outputs are stored verbatim (truncated at 10 KB per entry). |
| 4.4.2 | The card history view exposes each AgentRun's skill trace | Trace is collapsed by default; expanding shows each invocation as a numbered row with tool name, duration, and a toggle to reveal full inputs/outputs. |
| 4.4.3 | The board metrics view shows aggregate skill usage: invocation count and mean duration per tool, across all runs on that board | Filterable by date range, role, and card. |
| 4.4.4 | Skills that errored or produced empty output are flagged distinctly in the trace | Error entries show the raw error message returned by the tool. |
| 4.4.5 | Users can see which skills an agent used before it became blocked or failed | The skill trace up to the point of failure is always available even for incomplete runs. |
| 4.4.6 | Board admins can export the full skill trace for any AgentRun as JSON | Export is available from the card history view. |

---

### Milestone 5 — Learning & Retrospective
**Shippable as:** Continuous-improvement layer for teams that have completed at least one full card lifecycle.

This milestone closes the feedback loop. Once work has moved through the board — succeeded, failed, or been revised — the system helps the team understand what happened and surfaces actionable improvements to prompts, acceptance criteria, and tool configuration.

#### 5.1 Card Retrospective

A retro is automatically generated when a card reaches a terminal column. It is a structured summary of everything that happened to that card: what was attempted, what the agents did, where things went wrong, and what the final outcome was.

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 5.1.1 | When a card reaches a terminal column, a Card Retrospective is generated | Retro is generated automatically within 60 seconds of terminal entry. It is always accessible from the card, permanently. |
| 5.1.2 | The Card Retrospective contains: outcome summary, per-run breakdown (role, attempt, skills used, pass/fail per criterion), revision count, total wall-clock time, and a plain-English "what went wrong" narrative for any failed or revised runs | Narrative is produced by a dedicated analysis agent that reads the full card history and skill traces. It must cite specific evidence (e.g. skill invocation index, criterion ID, evaluation report excerpt) — vague summaries are not accepted. |
| 5.1.3 | The retro highlights skills that were invoked but produced no useful output, or that errored, contributing to a failure | These are displayed as "low-signal tools" with a count and examples. |
| 5.1.4 | The retro identifies acceptance criteria that required the most revision cycles | Criteria that failed evaluation more than once are flagged as "hard criteria" with a suggested rewrite. |
| 5.1.5 | Users can annotate the retro with a human note | Note is preserved alongside the generated content and included in board-level retro aggregation. |

#### 5.2 Board Retrospective

The board-level retro aggregates across all completed cards to surface systemic patterns.

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 5.2.1 | A Board Retrospective view shows aggregate insights across all cards that have reached a terminal state | Accessible from the board header. Regenerates on demand or on a weekly schedule. |
| 5.2.2 | The view shows: top recurring failure modes (grouped by similarity), most-revised acceptance criteria patterns, skills with highest error rates, and roles with the longest average cycle time | Each insight is ranked by frequency. Clicking an insight drills into the contributing cards. |
| 5.2.3 | The board retro surfaces suggested improvements to agent role system prompts based on observed failure patterns | Each suggestion is phrased as a diff: "Current prompt says X — consider changing to Y because Z cards failed when the agent did X." Suggestions are never applied automatically. |
| 5.2.4 | The board retro surfaces suggested new acceptance criteria based on criteria that were commonly added during revision | Shown as: "Cards of type [inferred] frequently added this criterion during revision: [criterion text]. Consider adding it to a board-level template." |
| 5.2.5 | Admins can mark a board retro insight as "actioned", "dismissed", or "watching" | Status is persisted. Actioned insights are excluded from future retro regenerations unless the pattern re-emerges. |

#### 5.3 Improvement Actions

Retro insights translate directly into board configuration changes.

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 5.3.1 | From a retro insight, admins can apply a suggested system prompt change to an agent role in one click | The change opens a diff editor pre-populated with the suggestion. Admin must confirm before saving. |
| 5.3.2 | From a retro insight, admins can add a suggested acceptance criterion to a reusable criterion library | Library criteria can be attached to future cards at creation time. |
| 5.3.3 | From a retro insight, admins can disable a specific tool for a given agent role | Disabled tools are excluded from that role's tool set at dispatch time. The change is logged as a board configuration event. |
| 5.3.4 | All improvement actions taken from a retro are recorded in a "Changes made" log visible on the board retro | Log entry shows: who made the change, what was changed, and which insight prompted it. |

---

## Cross-Cutting Requirements

These apply to all milestones.

| # | Requirement | Acceptance Criteria |
|---|---|---|
| X.1 | All user-facing text is internationalizable | No hardcoded strings in UI components. |
| X.2 | The board is usable on tablet-sized screens (≥768px) | No horizontal scrolling on a standard iPad viewport. |
| X.3 | Agent output never overwrites itself | `AgentRun.output` is append-only. |
| X.4 | A card in a terminal column never triggers agent dispatch | Terminal state is final unless a user explicitly moves the card back to an active column. |
| X.5 | The system degrades gracefully when the Anthropic API is unavailable | Cards remain visible. Queued dispatch retries when connectivity is restored. UI shows a connectivity warning. |
| X.6 | No Anthropic agent config is created at dispatch time | Agent configs are created once, by a setup script, and looked up at runtime. |

---

## Open Questions

These are product decisions not yet resolved. They should be answered before implementing the affected milestone.

| # | Question | Affects |
|---|---|---|
| OQ.2 | Is there a concept of a "board template" (e.g. a pre-configured set of columns and roles for a sprint board vs. a content pipeline)? | M2 |
| OQ.3 | What is the expected auth provider? (SSO, GitHub OAuth, email+password, or left to the implementer?) | M2 |
| OQ.4 | Should the Attention Queue (§3.3) send push notifications to mobile? Is a mobile-responsive web experience sufficient? | M3 |
| OQ.5 | Should skill traces be stored indefinitely or subject to a retention policy? Large boards with high agent throughput will accumulate significant trace data. | M4 |
| OQ.6 | Who triggers Board Retrospective generation — any board member, or admins only? Is the weekly schedule opt-in or opt-out? | M5 |
| OQ.7 | Should the retro analysis agent run on the same Anthropic account as the work agents, or is it a separate, read-only integration? | M5 |

> **Resolved:** OQ.3 (sequential agents across columns) — answered by §1.5. Each column type dispatches a specific agent class: Active columns dispatch the card's assigned work agent; Review columns always dispatch the evaluation agent. The card's `role` field governs the work agent only. SPEC.md should be updated to reflect the `isReviewState` column type and evaluation agent dispatch path.
