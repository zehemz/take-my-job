import type { OrchestratorDeps, SpawnRunner } from './types'

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AGENTS ?? '5', 10)
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS ?? '5', 10)

/**
 * Dispatch eligible cards and retry-eligible runs to agent runners.
 *
 * Stateless: queries the DB for the active run count and eligible cards
 * each tick. Uses claimAndCreateAgentRun for atomic claim-or-skip.
 */
export async function dispatchPending(
  deps: OrchestratorDeps,
  spawnRunner: SpawnRunner,
): Promise<void> {
  // ── 1. Fresh card dispatch ──────────────────────────────────
  const activeCount = await deps.db.countActiveRuns()
  const available = MAX_CONCURRENT - activeCount
  if (available <= 0) return

  const candidates = await deps.db.getEligibleCards(available, [])

  for (const card of candidates) {
    const run = await deps.db.claimAndCreateAgentRun(
      card.id,
      card.columnId,
      card.role ?? 'backend-engineer',
      1,
      MAX_CONCURRENT,
    )
    if (!run) continue // another process claimed it
    spawnRunner(card, run) // non-blocking
  }

  // ── 2. Retry-eligible runs ─────────────────────────────────
  const retryRuns = await deps.db.getRetryEligibleRuns()

  // Snapshot active count once before the loop; decrement locally as we claim
  let retryActiveCount = await deps.db.countActiveRuns()

  // Deduplicate: only retry once per card (the latest failed run wins)
  const seenCards = new Set<string>()
  for (const prevRun of retryRuns) {
    if (seenCards.has(prevRun.cardId)) continue
    seenCards.add(prevRun.cardId)

    if (retryActiveCount >= MAX_CONCURRENT) break
    // Guard: never exceed the attempt cap
    if (prevRun.attempt >= MAX_ATTEMPTS) continue

    const card = await deps.db.getCard(prevRun.cardId)
    if (!card) continue

    // Don't retry if card is in a terminal or inactive column
    if (card.column.isTerminalState || !card.column.isActiveState) continue

    const run = await deps.db.claimAndCreateAgentRun(
      prevRun.cardId,
      prevRun.columnId,
      prevRun.role,
      prevRun.attempt + 1,
      MAX_CONCURRENT,
    )
    if (!run) continue // another process claimed it

    retryActiveCount++ // track locally to avoid redundant DB queries

    // Clear retryAfterMs on the old run so it's not picked up again
    await deps.db.clearRetryAfter(prevRun.id)

    spawnRunner(card, run) // non-blocking
  }
}
