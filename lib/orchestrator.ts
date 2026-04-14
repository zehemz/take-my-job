import type { IOrchestrator } from './interfaces'
import { AgentRunStatus } from './types'
import type { AgentRun } from './types'
import { dispatchPending } from './orchestrator/dispatch'
import { reconcileRunning } from './orchestrator/reconcile'
import { scheduleRetry } from './orchestrator/retry'
import type { OrchestratorDeps, OrchestratorState, SpawnRunner, SpawnResumeRunner } from './orchestrator/types'

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
    private spawnResumeRunner: SpawnResumeRunner,
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
    // Wrapped in try-catch so a recovery error never prevents the poll loop from starting.
    try {
      const staleRuns = await this.deps.db.getRunningRuns()

      for (const run of staleRuns) {
        if (!run.sessionId) {
          // Never got a session — schedule retry with backoff
          await scheduleRetry(run, this.deps.db)
          continue
        }

        // Blocked runs: add to state so the reconciler moves the card; don't re-attach
        if (run.status === AgentRunStatus.blocked) {
          const card = await this.deps.db.getCard(run.cardId)
          if (card) {
            this.state.claimed.add(run.cardId)
            this.state.running.set(run.cardId, { run, abortController: new AbortController() })
          }
          continue
        }

        const session = await this.deps.anthropic.retrieveSession(run.sessionId)

        if (session.status === 'terminated') {
          if (session.outcome === 'success') {
            await this.deps.db.updateAgentRunStatus(run.id, AgentRunStatus.completed)
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
        await this.deps.db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
          retryAfterMs: Date.now(),
        })
      }
    } catch (err) {
      console.error('[orchestrator] recovery error (poll loop will still start):', err)
    }

    // ── 4. Start poll loop ──────────────────────────────────────
    const tick = async () => {
      try {
        await reconcileRunning(this.state, this.deps)
        await dispatchPending(this.state, this.deps, this.spawnRunner)
      } catch (err) {
        console.error('[orchestrator] tick error (loop continues):', err)
      } finally {
        this.timer = setTimeout(tick, this.pollInterval)
      }
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

  /** Called when a human replies to a blocked card (implements IOrchestrator). */
  async notifyCardUnblocked(cardId: string, run: AgentRun): Promise<void> {
    const card = await this.deps.db.getCard(cardId)
    if (!card) return

    const abortController = new AbortController()
    this.state.claimed.add(cardId)
    this.state.running.set(cardId, { run, abortController })
    this.spawnResumeRunner(card, run, abortController.signal)
  }

  /** Release a card from the claimed set so the next poll tick can re-dispatch it. */
  unclaim(cardId: string): void {
    this.state.claimed.delete(cardId)
  }

  /** Called when a card is moved on the board (implements IOrchestrator). */
  async notifyCardMoved(cardId: string, newColumnId: string): Promise<void> {
    const card = await this.deps.db.getCard(cardId)
    if (!card) return

    const column = card.column

    // Card moved to an active column — eagerly dispatch instead of waiting
    // for the next poll tick (which may never fire in serverless environments).
    if (column.isActiveState && !column.isTerminalState) {
      if (!this.state.claimed.has(cardId)) {
        const { dispatchPending } = await import('./orchestrator/dispatch')
        await dispatchPending(this.state, this.deps, this.spawnRunner)
      }
      return
    }

    const entry = this.state.running.get(cardId)
    if (entry) {
      // Session is tracked in memory — interrupt and clean up
      if (entry.run.sessionId) {
        await this.deps.anthropic.interruptSession(entry.run.sessionId)
      }
      await this.deps.db.updateAgentRunStatus(entry.run.id, AgentRunStatus.cancelled)
      entry.abortController.abort()
      this.state.running.delete(cardId)
      this.state.claimed.delete(cardId)
    } else {
      // Not in memory (e.g. server restarted mid-run) — check DB for any live session
      const activeRun = await this.deps.db.getActiveRunForCard(cardId)
      if (activeRun) {
        if (activeRun.sessionId) {
          await this.deps.anthropic.interruptSession(activeRun.sessionId)
        }
        await this.deps.db.updateAgentRunStatus(activeRun.id, AgentRunStatus.cancelled)
      }
      this.state.claimed.delete(cardId)
    }
  }
}

export default Orchestrator
