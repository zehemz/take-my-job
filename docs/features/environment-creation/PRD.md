# PRD — Environment Creation with Presets

## Problem

Environments are currently created exclusively via the Anthropic console or the `scripts/setup-agents.ts` script, which provisions a single bare environment with no packages. Operators who want a role-appropriate environment (e.g., a backend-engineer sandbox with Node.js, TypeScript, and git pre-installed) must either re-run the setup script or manually edit the environment after creation via the `/environments/[id]` detail page. There is no way to create a new environment from the Kobani UI at all.

## Goal

Add an **environment creation flow** to the backoffice that lets admins create new Anthropic environments from within Kobani, optionally starting from a **preset template** tailored to a role (e.g., "Node.js Backend", "Python ML", "Full-stack"). After creation, the environment can be immediately assigned to an agent via the existing agent management UI.

## Users

- **Operators / admins** — team members who manage Kobani environments and need to provision sandboxes for different agent roles without leaving the UI or running scripts.

## Requirements

### Must have (v1)

1. A "Create Environment" button on the `/environments` list page.
2. A creation form/modal with fields:
   - **Name** (required, 1-256 chars)
   - **Description** (optional)
   - **Preset template** (optional) — selecting a preset pre-fills packages and networking config. The admin can still modify before saving.
3. Built-in presets:
   - **Blank** — unrestricted networking, no packages (current default)
   - **Node.js Backend** — unrestricted networking, npm: `typescript, tsx, prisma, @prisma/client`, apt: `git, curl, jq`
   - **Python ML** — unrestricted networking, pip: `numpy, pandas, scikit-learn, jupyter`, apt: `git, curl`
   - **Full-stack** — unrestricted networking, npm: `typescript, tsx, prisma, @prisma/client, playwright`, pip: `requests`, apt: `git, curl, jq`
   - **QA / Testing** — unrestricted networking, npm: `playwright, @playwright/test, typescript`, apt: `git, curl`
4. Network policy selection (unrestricted vs. limited with sub-options) — same controls as the existing detail page editor.
5. Package lists editable before submission — same per-manager fields as the existing detail page editor.
6. On successful creation, redirect to the new environment's detail page.
7. Admin-only access (same guard as PATCH/DELETE on environments).

### Nice to have (post-v1)

- Custom user-defined presets (saved to DB).
- "Duplicate environment" action from the detail page.
- Auto-assign the newly created environment to a selected agent role in one step.
- Preset management page where admins can edit the template library.

## Non-goals

- Changing how environments are linked to agents (`AgentConfig` wiring) — that's a separate concern.
- Replacing the setup script — it remains useful for initial provisioning.
- Environment versioning or rollback.

## Success criteria

1. An admin can create a new environment from `/environments` without leaving the Kobani UI.
2. Selecting a preset pre-fills sensible defaults; the admin can review and modify before creating.
3. The created environment appears in the Anthropic API and is immediately visible in the environment list.
4. Non-admin users cannot access the creation flow (403).
5. Creation errors (Anthropic API failures, validation) are surfaced clearly in the UI.
