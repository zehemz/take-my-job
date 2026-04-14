import type { OrchestratorState, OrchestratorDeps, SpawnRunner } from './types'
import { config } from '../config'

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
  const available = config.MAX_CONCURRENT_AGENTS - state.running.size
  if (available <= 0) return

  const candidates = await deps.db.getEligibleCards(available, [...state.claimed])

  for (const card of candidates) {
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

  for (const prevRun of retryRuns) {
    if (state.claimed.has(prevRun.cardId)) continue
    if (state.running.size >= config.MAX_CONCURRENT_AGENTS) break
    // Guard: never exceed the attempt cap, even if retryAfterMs was set unexpectedly.
    if (prevRun.attempt >= config.MAX_ATTEMPTS) continue

    const card = await deps.db.getCard(prevRun.cardId)
    if (!card) continue

    const run = await deps.db.createAgentRun(
      prevRun.cardId,
      prevRun.columnId,
      prevRun.role,
      prevRun.attempt + 1,
    )
    state.claimed.add(prevRun.cardId)
    spawnRunner(card, run) // non-blocking
  }
}
