import { scheduleRetry } from './retry'
import type { OrchestratorDeps, SpawnRunner } from './types'
import { AgentRunStatus } from '../types'
import { config } from '../config'

const MAX_STALL_MS = parseInt(process.env.MAX_STALL_MS ?? '3600000', 10)

const NUDGE_MESSAGE =
  'Please continue working on the task. Remember to call update_card(completed) when done.'

export async function reconcileRunning(
  deps: OrchestratorDeps,
  spawnRunner?: SpawnRunner,
): Promise<void> {
  const activeRuns = await deps.db.getActiveRuns()

  // CRITICAL: all checks in parallel, never serial
  await Promise.all(
    activeRuns.map(async (run) => {
      const card = run.card

      // 1. If run is blocked — move card to blocked column
      if (run.status === AgentRunStatus.blocked) {
        try {
          await deps.db.moveCardToColumnType(card.id, card.boardId, 'blocked')
        } catch (err) {
          console.error('[reconcile] failed to move blocked card:', err)
        }
        return
      }

      // 2. If column is terminal or inactive → cancel
      if (card.column.isTerminalState || !card.column.isActiveState) {
        if (run.sessionId) {
          try {
            await deps.anthropic.interruptSession(run.sessionId)
          } catch (err) {
            console.error('[reconcile] failed to interrupt session:', err)
          }
        }
        await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.cancelled)
        return
      }

      // 3. Check session status
      if (run.sessionId) {
        const session = await deps.anthropic.retrieveSession(run.sessionId)
        if (session.status === 'terminated') {
          if (session.outcome === 'success') {
            await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.completed)
            const targetColumnType: 'review' | 'terminal' = card.requiresApproval ? 'review' : 'terminal'
            try {
              await deps.db.moveCardToColumnType(card.id, card.boardId, targetColumnType)
            } catch (err) {
              console.error('[reconcile] failed to route card after completion:', err)
            }
          } else {
            await scheduleRetry(run, deps.db)
          }
          return
        }

        // 3b. Session idle — event loop may have died before nudging
        if (session.status === 'idle') {
          // If update_card already wrote a status_change, the run is done
          const alreadyDone = await deps.db.hasRunEvent(run.id, 'status_change')
          if (alreadyDone) return

          // Is there a turn_ended without a matching continue_sent?
          const turnEnded = await deps.db.countRunEvents(run.id, 'turn_ended')
          const continueSent = await deps.db.countRunEvents(run.id, 'continue_sent')
          if (turnEnded > continueSent) {
            // Unhandled idle — the event loop died before nudging
            if (turnEnded < config.MAX_TURNS) {
              await deps.anthropic.sendMessage(run.sessionId, {
                type: 'user.message',
                content: NUDGE_MESSAGE,
              })
              await deps.db.insertOrchestratorEvent({
                boardId: card.boardId,
                cardId: card.id,
                runId: run.id,
                type: 'continue_sent',
                payload: {},
              })
              // Re-attach the stream if a runner spawner is available
              if (spawnRunner) {
                spawnRunner(card, run)
              }
            } else {
              await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
                error: `Max turns (${config.MAX_TURNS}) reached without completing the task.`,
              })
            }
          }
          return
        }
      }

      // 4. Stall detection
      const stalledMs = Date.now() - run.updatedAt.getTime()
      if (stalledMs > MAX_STALL_MS) {
        if (run.sessionId) {
          try {
            await deps.anthropic.interruptSession(run.sessionId)
          } catch (err) {
            console.error('[reconcile] failed to interrupt stalled session:', err)
          }
        }
        await scheduleRetry(run, deps.db)
      }
    })
  )
}
