import type { IOrchestrator } from './interfaces'
import { AgentRunStatus } from './types'
import type { AgentRun } from './types'
import { dispatchPending } from './orchestrator/dispatch'
import { reconcileRunning } from './orchestrator/reconcile'
import { scheduleRetry } from './orchestrator/retry'
import type { OrchestratorDeps, SpawnRunner, SpawnResumeRunner } from './orchestrator/types'

export type { OrchestratorDeps, SpawnRunner }

const POLL_MIN_MS = 1000
const POLL_MAX_MS = 30000
const POLL_DEFAULT_MS = 3000

function clampPollInterval(raw: number): number {
  return Math.max(POLL_MIN_MS, Math.min(POLL_MAX_MS, raw))
}

export class Orchestrator implements IOrchestrator {
  private timer: ReturnType<typeof setTimeout> | null = null
  private pollInterval: number
  private lastTickAt: Date = new Date(0)

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
    // ── 1. Recover running/idle AgentRuns from previous process ─
    try {
      const staleRuns = await this.deps.db.getRunningRuns()

      for (const run of staleRuns) {
        if (!run.sessionId) {
          await scheduleRetry(run, this.deps.db)
          continue
        }

        if (run.status === AgentRunStatus.blocked) {
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
            this.spawnRunner(card, run)
          }
        }
      }

      // ── 2. Make retry-eligible runs immediately dispatchable ────
      const retryRuns = await this.deps.db.getRetryEligibleRuns()
      for (const run of retryRuns) {
        await this.deps.db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
          retryAfterMs: Date.now(),
        })
      }
    } catch (err) {
      console.error('[orchestrator] recovery error (poll loop will still start):', err)
    }

    // ── 3. Start poll loop ──────────────────────────────────────
    this.lastTickAt = new Date()
    const tick = async () => {
      try {
        await reconcileRunning(this.deps)
        await this.processEvents()
        await dispatchPending(this.deps, this.spawnRunner)
        this.lastTickAt = new Date()
      } catch (err) {
        console.error('[orchestrator] tick error (loop continues):', err)
      } finally {
        this.timer = setTimeout(tick, this.pollInterval)
      }
    }
    this.timer = setTimeout(tick, this.pollInterval)
  }

  /** Stop the poll loop. */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** Called when a human replies to a blocked card (implements IOrchestrator). */
  async notifyCardUnblocked(cardId: string, run: AgentRun): Promise<void> {
    const card = await this.deps.db.getCard(cardId)
    if (!card) return

    await this.deps.db.insertOrchestratorEvent({
      boardId: card.boardId,
      cardId,
      runId: run.id,
      type: 'card_unblocked',
      payload: {},
    })

    this.spawnResumeRunner(card, run)
  }

  /** Release a card from the claimed set — no-op in stateless orchestrator. */
  unclaim(_cardId: string): void {
    // No-op: stateless orchestrator has no in-memory claimed set.
  }

  /** Called when a card is moved on the board (implements IOrchestrator). */
  async notifyCardMoved(cardId: string, _newColumnId: string): Promise<void> {
    const card = await this.deps.db.getCard(cardId)
    if (!card) return

    await this.deps.db.insertOrchestratorEvent({
      boardId: card.boardId,
      cardId,
      type: 'card_moved',
      payload: { newColumnId: card.columnId },
    })
  }

  /** Process events that arrived since the last tick. */
  private async processEvents(): Promise<void> {
    const events = await this.deps.db.getOrchestratorEventsSince(
      this.lastTickAt,
      ['card_moved', 'card_unblocked'],
    )

    for (const event of events) {
      if (event.type === 'card_moved') {
        const card = await this.deps.db.getCard(event.cardId)
        if (!card) continue

        if (!card.column.isTerminalState && card.column.isActiveState) continue

        // Find active runs for this card and cancel them
        const activeRuns = await this.deps.db.getActiveRuns()
        const cardRuns = activeRuns.filter(r => r.cardId === event.cardId)

        for (const run of cardRuns) {
          if (run.sessionId) {
            await this.deps.anthropic.interruptSession(run.sessionId)
          }
          await this.deps.db.updateAgentRunStatus(run.id, AgentRunStatus.cancelled)
        }
      }
      // card_unblocked events are handled eagerly in notifyCardUnblocked
    }
  }
}

export default Orchestrator
