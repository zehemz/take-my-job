import { scheduleRetry } from './retry'
import type { OrchestratorDeps } from './types'
import { AgentRunStatus } from '../types'

const MAX_STALL_MS = parseInt(process.env.MAX_STALL_MS ?? '3600000', 10)

export async function reconcileRunning(
  deps: OrchestratorDeps
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
          await deps.anthropic.interruptSession(run.sessionId)
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
        // running/idle → agent runner handling it, no-op
      }

      // 4. Stall detection
      const stalledMs = Date.now() - run.updatedAt.getTime()
      if (stalledMs > MAX_STALL_MS) {
        if (run.sessionId) {
          await deps.anthropic.interruptSession(run.sessionId)
        }
        await scheduleRetry(run, deps.db)
      }
    })
  )
}
