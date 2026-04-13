# Kobani — Brand Book

> This document defines the complete brand identity for Kobani: who we are, how we look, and how we speak. All product, design, and marketing decisions should be consistent with what is written here.

---

## 1. Brand Foundation

### 1.1 What Kobani Is

Kobani is the work surface for product teams that refuse to let execution slow them down. It is a Kanban board where AI agents handle the doing — writing code, drafting copy, producing specs, running tests — while humans stay in the role they are actually valuable in: making decisions, setting direction, and approving outcomes.

It is not a project management tool with an AI feature bolted on. The entire product is designed around the assumption that most task execution can and should be delegated to agents. Humans show up at decision points, not at every step.

### 1.2 Core Promise

> **Move a card. Get work done.**

This is the product promise and the brand promise. It is literal and it is ambitious. When it is true, every other differentiator is secondary.

### 1.3 Brand Positioning

| | Kobani | Traditional PM Tools | AI Coding Assistants |
|---|---|---|---|
| **Primary user** | Product teams (all roles) | Managers and PMs | Individual developers |
| **AI role** | Executes work end-to-end | Writes summaries, suggests | Autocompletes code |
| **Human role** | Decides, directs, approves | Manages and reports | Writes and reviews |
| **Unit of work** | Card (multi-step, multi-agent) | Task or ticket | Line or function |

Kobani competes on a different axis than Jira, Linear, or GitHub Copilot. It is the first tool where the board itself is productive — not just a map of what humans are doing, but the surface through which agents get dispatched and results flow back.

### 1.4 Brand Values

**Precision over ceremony.** Every interaction is purposeful. We do not add steps, confirmations, or features that exist to make the product feel enterprise-y. We earn trust by being exactly right, not by being thorough.

**Humans in control, never out of the loop.** The agent works; the human decides. No card advances past a Review column without a human sign-off. The Attention Queue exists because we believe that when something needs a human, that human should hear about it immediately — not at standup.

**Transparent execution.** Agents stream their output in real time. Users can see exactly what the agent is doing, why it got blocked, what the evaluator found. There are no black boxes.

**Quiet confidence.** We do not shout. The product does not celebrate itself. A card moves to Done when the work is done — there is no confetti. Teams that ship serious work deserve a tool that takes itself seriously.

---

## 2. Brand Name & Origin

**Kobani** (also spelled Kobanê) is a city in northern Syria, known internationally as a symbol of tenacity — a place that held its ground when surrounded, that rebuilt after destruction, that refused to be erased. It is a name that carries weight without requiring explanation.

We chose it because it reflects the spirit of the product: not glamorous, not loud, but resolute. Kobani does not promise magic. It promises that the work gets done.

### Usage Rules

- Always capitalized: **Kobani** (not KOBANI, not kobani)
- Never abbreviated (not "Kob" or "K")
- The product is **Kobani** — not "Kobani AI" or "Kobani App"
- When referring to the board feature specifically: "a Kobani board" or "your board"

---

## 3. Voice & Tone

### 3.1 Brand Voice

Kobani speaks like the best engineer on your team: direct, precise, and entirely without ego. We say what needs to be said, nothing more. We do not explain things the user already knows. We do not congratulate them for completing routine actions.

**Direct.** "Agent blocked on Auth flow redesign. Your input is needed." — not "It looks like your agent may need some help!"

**Precise.** "2 criteria failed: token logging at auth.ts:94, 3 test regressions in user.test.ts." — not "The evaluation did not fully pass."

**Honest.** If the agent failed, we say it failed. If a retry is happening, we show the attempt number and the next retry time. We do not soften bad news.

**Calm under pressure.** Status messages are factual, not alarming. Even when something is URGENT, the label is informational — the urgency is communicated through clarity, not exclamation marks.

### 3.2 Tone by Context

| Context | Tone | Example |
|---|---|---|
| Empty states | Inviting, brief | "No cards in this column. Drag one in to start." |
| Agent running | Neutral, informational | "Running · Attempt 1 of 5 · Started 2 min ago" |
| Agent blocked | Direct, actionable | "Agent needs your input before it can continue." |
| Evaluation passed | Understated | "All criteria passed. Your sign-off is needed." |
| Evaluation failed | Specific, not accusatory | "2 criteria not met. See the evaluation report." |
| Error states | Factual, with next step | "Session terminated. Retrying in 38s (attempt 2 of 5)." |
| Onboarding | Clear, no jargon | "Create a board, add a card, move it to In Progress. An agent will handle the rest." |

### 3.3 Words We Use

| Use | Avoid |
|---|---|
| Card | Ticket, task, issue |
| Move a card | Transition, progress |
| Agent | Bot, AI assistant, automation |
| Dispatched | Triggered, launched, fired |
| Blocked | Stuck, waiting (when agent-initiated) |
| Revision Needed | Failed, rejected |
| Sign-off | Approval (acceptable), sign-off preferred |
| Column | Lane, swim lane, stage |
| Terminal | Complete, finished (when describing column type) |

### 3.4 Writing Principles

- **Lead with the fact.** Status messages state the condition first, then context. Never bury the lede.
- **Omit needless words.** "Agent blocked" is better than "The agent has been blocked." UI is not prose.
- **Numbers over approximations.** "38s" beats "about a minute." "2 of 4 criteria" beats "most criteria."
- **Active over passive.** "Agent failed after 5 attempts" — not "5 attempts were made."
- **No filler affirmations.** We never write "Great!", "Nice work!", or "You're all set!"

---

## 4. Visual Identity

### 4.1 Color Palette

The Kobani palette is anchored in deep, neutral darks with a single warm amber primary. Color is used functionally — status, emphasis, action — not decoratively.

#### Foundation

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0D0F14` | Page and app background |
| `--color-surface` | `#13161E` | Cards, panels, sidebars |
| `--color-surface-raised` | `#1C2030` | Elevated surfaces, modals, dropdowns |
| `--color-border` | `#252A38` | Dividers, card outlines, column borders |
| `--color-border-subtle` | `#1A1E2B` | Subtle separators |

#### Text

| Token | Hex | Usage |
|---|---|---|
| `--color-text-primary` | `#F0F2F7` | Body text, card titles |
| `--color-text-secondary` | `#8892A4` | Metadata, timestamps, labels |
| `--color-text-tertiary` | `#4D5668` | Placeholder text, disabled states |

#### Brand Primary — Amber

| Token | Hex | Usage |
|---|---|---|
| `--color-amber-500` | `#F5A623` | Primary actions, active agent indicator, links |
| `--color-amber-400` | `#F7BA52` | Hover states |
| `--color-amber-600` | `#D4891A` | Pressed/active states |
| `--color-amber-900` | `#2A1F09` | Amber tint backgrounds (e.g. "Running" badge bg) |

Amber was chosen because it connotes energy, forward motion, and controlled urgency — qualities that describe what an agent in motion looks like. It is warm without being red (danger) or green (done).

#### Status Colors

| Token | Hex | Status | Used for |
|---|---|---|---|
| `--color-status-running` | `#F5A623` | Running | Agent actively working |
| `--color-status-idle` | `#4D5668` | Idle | Card has no agent |
| `--color-status-blocked` | `#F59E0B` | Blocked | Agent waiting for human |
| `--color-status-failed` | `#EF4444` | Failed | Agent run failed |
| `--color-status-evaluating` | `#A78BFA` | Evaluating | QA agent reviewing work |
| `--color-status-eval-failed` | `#F87171` | Eval failed | Criteria not met |
| `--color-status-pending` | `#60A5FA` | Pending approval | Awaiting human sign-off |
| `--color-status-done` | `#22C55E` | Done | Card in terminal state |
| `--color-status-urgent` | `#DC2626` | Urgent | Blocked >1h |

Status colors should only appear in badges, indicators, and borders — not as background fills on large surfaces.

#### Semantic

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#22C55E` | Confirmations, passed criteria |
| `--color-warning` | `#F59E0B` | Cautions, blocked states |
| `--color-danger` | `#EF4444` | Destructive actions, failures |
| `--color-info` | `#60A5FA` | Informational highlights |

### 4.2 Typography

**Primary typeface:** [Geist](https://vercel.com/font) — a modern geometric sans-serif designed for interfaces. Clean, legible at small sizes, and slightly technical in character without feeling cold.

**Monospace typeface:** Geist Mono — used for all code output, agent output, file paths, CLI commands, and technical identifiers. This is important: agent output is monospace by default, reinforcing that it is machine output, not editorial content.

#### Type Scale

| Role | Size | Weight | Line Height | Token |
|---|---|---|---|---|
| Display | 32px | 700 | 1.2 | `--type-display` |
| Heading 1 | 24px | 600 | 1.3 | `--type-h1` |
| Heading 2 | 18px | 600 | 1.35 | `--type-h2` |
| Heading 3 | 14px | 600 | 1.4 | `--type-h3` |
| Body | 14px | 400 | 1.5 | `--type-body` |
| Body Small | 12px | 400 | 1.5 | `--type-body-sm` |
| Label | 11px | 500 | 1.4 | `--type-label` |
| Code | 13px | 400 | 1.6 | `--type-code` |

**Rules:**
- Column headers (BACKLOG, IN PROGRESS, etc.) are `--type-label` in all-caps with 0.08em letter-spacing
- Card titles are `--type-body` weight 500
- Status badges are `--type-label`
- Agent output is always `--type-code` in Geist Mono
- No decorative fonts anywhere in the product

### 4.3 Spacing & Grid

The layout system is built on an 8px base unit.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight internal padding |
| `--space-2` | 8px | Component padding (badges, labels) |
| `--space-3` | 12px | Small gaps |
| `--space-4` | 16px | Standard component padding |
| `--space-5` | 20px | Medium gaps |
| `--space-6` | 24px | Section padding |
| `--space-8` | 32px | Large gaps |
| `--space-10` | 40px | Page-level padding |

The board layout uses a horizontal scroll container. Columns have a fixed width of 280px with 16px gutters. Cards within columns use 8px vertical gaps.

### 4.4 Iconography

Use [Lucide Icons](https://lucide.dev) exclusively — they are the reference icon set for this product.

**Rules:**
- Default stroke width: 1.5px
- Size in-context: 16px (inline) or 20px (standalone actions)
- Never fill icons — always stroke-only
- Status icons are the only icons that carry color; all other icons inherit `--color-text-secondary`

**Reserved status icons:**

| Icon | Lucide name | Status |
|---|---|---|
| ⟳ | `loader-2` (animated) | Running |
| ○ | `circle` | Idle |
| ⚠ | `alert-triangle` | Blocked |
| ✗ | `x-circle` | Failed / Eval Failed |
| 🔍 | `search` | Evaluating |
| ⏳ | `clock` | Pending Approval |
| ✓ | `check-circle` | Done / Passed |

### 4.5 Elevation & Depth

Kobani does not use shadows to convey depth. Elevation is expressed through background color — darker means lower, lighter means higher.

| Level | Background | Usage |
|---|---|---|
| 0 — Page | `--color-bg` | App background |
| 1 — Surface | `--color-surface` | Board canvas, panels |
| 2 — Raised | `--color-surface-raised` | Cards, modals, dropdowns |
| 3 — Overlay | `#222840` | Tooltips, context menus |

Borders at `--color-border` define edges between surfaces. A single `1px` border is always preferred over a shadow.

### 4.6 Motion

Animation is functional, not decorative.

| Interaction | Duration | Easing |
|---|---|---|
| Card drag | 0ms (instant) | — |
| Card drop / reorder | 150ms | `ease-out` |
| Column transition | 200ms | `ease-in-out` |
| Badge state change | 100ms | `ease-out` |
| Panel open/close | 200ms | `ease-in-out` |
| Notification entry | 250ms | `ease-out` |
| Streaming text | — | No animation, appended raw |

**Rules:**
- Agent output is never animated — tokens append immediately as received
- Status badge changes are instant with a 100ms color crossfade
- No bounce, spring, or decorative ease curves
- Reduced motion preference is always respected

### 4.7 Logo Concept

The Kobani wordmark is set in Geist weight 700, with a small amber square (8×8px) placed to the left of the "K" as an anchor mark. The square represents a card — the atomic unit of the product.

```
■ Kobani
```

The mark is always displayed in one of two forms:
- **Light on dark:** `--color-text-primary` wordmark + `--color-amber-500` square (default)
- **Dark on light:** `#0D0F14` wordmark + `#D4891A` square (print, light backgrounds)

No gradient, no shadow, no embellishment on the wordmark.

---

## 5. UI Component Principles

### Card

The card is the most important element in the product. It should feel like a physical index card placed on a physical board — bounded, discrete, movable.

- Background: `--color-surface-raised`
- Border: `1px solid --color-border`
- Border-radius: `6px`
- Padding: `12px`
- Status badge: top-right, always visible, never truncated
- Title: weight 500, max 2 lines, then ellipsis
- Assignee avatar: bottom-left, 20px diameter
- Accent left border (4px) when agent is running (color: `--color-status-running`)

### Column Header

- All-caps label in `--type-label`
- Card count shown as a plain number, not a badge
- Column type indicator (Active, Review, etc.) shown as a subtle tint on the header bar
- No add-card button in the header — card creation belongs at the bottom of the column

### Status Badges

Badges are pill-shaped, 4px radius, using the status background tint (900-level) and status color for text and icon. They never exceed one line.

### Agent Output Panel

- Background: `--color-bg` (darkest level — it's a terminal, not a surface)
- Font: Geist Mono 13px
- Text color: `--color-text-secondary` for past output, `--color-text-primary` for the live cursor line
- A blinking `▌` cursor is shown on the active output line only
- No syntax highlighting — output is raw Markdown rendered to HTML, not code

### Attention Queue Items

Items in the Attention Queue use a card layout with a colored left border:
- Blocked: `--color-status-blocked` (#F59E0B)
- Revision Needed: `--color-status-eval-failed` (#F87171)
- Pending Approval: `--color-status-pending` (#60A5FA)
- Urgent (>1h blocked): `--color-status-urgent` (#DC2626), full border

---

## 6. Marketing Identity

### 6.1 Taglines

**Primary:**
> Move a card. Get work done.

**Secondary options for campaigns/contexts:**

- "AI executes. You decide." — emphasizes human-in-the-loop
- "The board that works while you sleep." — async teams, global orgs
- "Ship without the grind." — developer persona
- "Your team's execution layer." — PM/EM persona
- "Every card is a brief. Every brief gets done." — content/designer persona

### 6.2 Elevator Pitch

**One sentence:**
Kobani is a Kanban board where AI agents do the work — writing code, drafting copy, running tests — while your team stays focused on decisions and direction.

**Three sentences:**
Most teams use boards to track who is doing what. Kobani changes what the board does: move a card to an active column and an AI agent is dispatched immediately to complete the work. Your team's job is to review, approve, and redirect — not to execute.

**One paragraph:**
Kobani is the work surface for product organizations where execution is no longer the bottleneck. Developers, product owners, content writers, and designers all work from the same Kanban board. When a card enters an active column, an AI agent — the right one for the job — picks it up, does the work, and streams back its output in real time. A QA agent evaluates the result against the card's acceptance criteria. If it passes, it asks for your sign-off. If it fails, it sends the card back with a full evaluation report. You stay in control at every decision point. The work just gets done.

### 6.3 Target Audience

**Primary:** Engineering-led product teams at startups and scale-ups (10–200 engineers) who already use AI tools individually and want to coordinate AI execution at the team level.

**Secondary:** Product and operations leaders at agencies or consultancies managing multiple concurrent workstreams, where human bandwidth is the primary bottleneck.

**Early adopters:** Engineering managers and tech leads who feel the friction of coordinating agent work across Slack, GitHub, and individual Claude/Cursor sessions. Kobani gives that work a shared surface and a shared audit trail.

### 6.4 What We Never Say

- "AI-powered" — everything is AI-powered. We say what the AI does.
- "Supercharge your workflow" — vague and worn out
- "Seamless" — never use this word
- "Game-changing" / "revolutionary" — let the product speak
- "Cutting-edge" — implies instability
- "Magic" — we are about transparency, not mystification

---

## 7. Brand in Product — Quick Reference

| Moment | Voice rule | Visual rule |
|---|---|---|
| Card created | No celebration | Status badge changes to Idle |
| Agent dispatched | Informational: "Running · Attempt 1" | Amber left border on card |
| Agent blocked | Factual: "Agent needs your input" | Warning amber badge, bell increments |
| Evaluation failed | Specific: "2 criteria not met" | Red badge, full failure report visible |
| Evaluation passed | Understated: "All criteria passed. Sign-off needed." | Blue badge |
| Human approved | No celebration | Card moves to Done, green badge, terminal |
| Error / retry | Factual with countdown | No color change beyond status badge |

---

*Last updated: 2026-04-13*
