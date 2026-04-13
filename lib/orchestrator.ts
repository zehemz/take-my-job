import type { IOrchestrator } from './interfaces.js'
import { dispatchPending } from './orchestrator/dispatch.js'
import { reconcileRunning } from './orchestrator/reconcile.js'
import { scheduleRetry } from './orchestrator/retry.js'
import type { OrchestratorDeps, OrchestratorState, SpawnRunner } from './orchestrator/types.js'

export type { OrchestratorDeps, OrchestratorState, SpawnRunner }

const POLL_MIN_MS = 1000
const POLL_MAX_MS = 30000
const POLL_DEFAULT_MS = 3000

function clampPollInterval(raw: number): number {
  return Math.max(POLL_MIN_MS, Math.min(POLL_MAX_MS, raw))
}

export class Orchestrator implements IOrchestrator {
  private state: OrchestratorState = {
    running: new Map(),
    claimed: new Set(),
  }

  private timer: ReturnType<typeof setTimeout> | null = null
  private pollInterval: number

  constructor(
    private deps: OrchestratorDeps,
    private spawnRunner: SpawnRunner,
  ) {
    const envMs = parseInt(process.env.POLL_INTERVAL_MS ?? '', 10)
    this.pollInterval = clampPollInterval(Number.isNaN(envMs) ? POLL_DEFAULT_MS : envMs)
  }

  /** Startup recovery (SPEC §5.6) then poll loop. */
  async start(): Promise<void> {
    // ── 1. Clear stale in-memory state ──────────────────────────
    this.state.running.clear()
    this.state.claimed.clear()

    // ── 2. Recover running/idle AgentRuns from previous process ─
    const staleRuns = await this.deps.db.getRunningRuns()

    for (const run of staleRuns) {
      if (!run.sessionId) {
        // Never got a session — schedule retry with backoff
        await scheduleRetry(run, this.deps.db)
        continue
      }

      const session = await this.deps.anthropic.retrieveSession(run.sessionId)

      if (session.status === 'terminated') {
        if (session.outcome === 'success') {
          await this.deps.db.updateAgentRunStatus(run.id, 'completed')
        } else {
          await scheduleRetry(run, this.deps.db)
        }
      } else {
        // Session still alive — re-attach
        const card = await this.deps.db.getCard(run.cardId)
        if (card) {
          this.state.claimed.add(run.cardId)
          const abortController = new AbortController()
          this.state.running.set(run.cardId, { run, abortController })
          this.spawnRunner(card, run)
        }
      }
    }

    // ── 3. Make retry-eligible runs immediately dispatchable ────
    const retryRuns = await this.deps.db.getRetryEligibleRuns()
    for (const run of retryRuns) {
      await this.deps.db.updateAgentRunStatus(run.id, 'failed', {
        retryAfterMs: Date.now(),
      })
    }

    // ── 4. Start poll loop ──────────────────────────────────────
    const tick = async () => {
      await reconcileRunning(this.state, this.deps)
      await dispatchPending(this.state, this.deps, this.spawnRunner)
      this.timer = setTimeout(tick, this.pollInterval)
    }
    this.timer = setTimeout(tick, this.pollInterval)
  }

  /** Stop the poll loop and interrupt all active sessions. */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }

    for (const [, entry] of this.state.running) {
      if (entry.run.sessionId) {
        this.deps.anthropic.interruptSession(entry.run.sessionId).catch(() => {
          // best-effort interrupt on shutdown
        })
      }
      entry.abortController.abort()
    }

    this.state.running.clear()
    this.state.claimed.clear()
  }

  /** Called when a card is moved on the board (implements IOrchestrator). */
  async notifyCardMoved(cardId: string, newColumnId: string): Promise<void> {
    const card = await this.deps.db.getCard(cardId)
    if (!card) return

    const column = card.column

    // Only act if the card moved to a terminal or inactive column
    if (!column.isTerminalState && column.isActiveState) return

    const entry = this.state.running.get(cardId)
    if (!entry) return

    // Interrupt the Anthropic session
    if (entry.run.sessionId) {
      await this.deps.anthropic.interruptSession(entry.run.sessionId)
    }

    // Transition the run to cancelled
    await this.deps.db.updateAgentRunStatus(entry.run.id, 'cancelled')

    // Clean up in-memory state
    entry.abortController.abort()
    this.state.running.delete(cardId)
    this.state.claimed.delete(cardId)
  }
}

export default Orchestrator
