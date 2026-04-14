import type { OrchestratorState, OrchestratorDeps, SpawnRunner } from './types'

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AGENTS ?? '5', 10)
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS ?? '5', 10)

/**
 * Dispatch eligible cards and retry-eligible runs to agent runners.
 *
 * Called once per orchestrator tick, after reconciliation.
 * Spawns are fire-and-forget — the orchestrator poll loop does NOT await them.
 */
export async function dispatchPending(
  state: OrchestratorState,
  deps: OrchestratorDeps,
  spawnRunner: SpawnRunner,
): Promise<void> {
  // ── 1. Fresh card dispatch ──────────────────────────────────
  const available = MAX_CONCURRENT - state.running.size
  if (available <= 0) return

  const candidates = await deps.db.getEligibleCards(available, [...state.claimed])

  for (const card of candidates) {
    // DB-level guard: skip if a pending/running run already exists
    const existingActive = await deps.db.getActiveRunForCard(card.id)
    if (existingActive) continue

    const run = await deps.db.createAgentRun(
      card.id,
      card.columnId,
      card.role ?? 'backend-engineer',
      1,
    )
    state.claimed.add(card.id)
    spawnRunner(card, run) // non-blocking
  }

  // ── 2. Retry-eligible runs ─────────────────────────────────
  const retryRuns = await deps.db.getRetryEligibleRuns()

  // Deduplicate: only retry once per card (the latest failed run wins)
  const seenCards = new Set<string>()
  for (const prevRun of retryRuns) {
    if (seenCards.has(prevRun.cardId)) continue
    seenCards.add(prevRun.cardId)
    if (state.claimed.has(prevRun.cardId)) continue
    if (state.running.size >= MAX_CONCURRENT) break
    // Guard: never exceed the attempt cap, even if retryAfterMs was set unexpectedly.
    if (prevRun.attempt >= MAX_ATTEMPTS) continue

    // DB-level guard: skip if a pending/running run already exists for this card
    const existingActive = await deps.db.getActiveRunForCard(prevRun.cardId)
    if (existingActive) continue

    const card = await deps.db.getCard(prevRun.cardId)
    if (!card) continue

    const run = await deps.db.createAgentRun(
      prevRun.cardId,
      prevRun.columnId,
      prevRun.role,
      prevRun.attempt + 1,
    )

    // Clear retryAfterMs on the old run so it's not picked up again
    await deps.db.clearRetryAfter(prevRun.id)

    state.claimed.add(prevRun.cardId)
    spawnRunner(card, run) // non-blocking
  }
}
