import { scheduleRetry } from './retry'
import type { OrchestratorState, OrchestratorDeps } from './types'
import { AgentRunStatus } from '../types'

const MAX_STALL_MS = parseInt(process.env.MAX_STALL_MS ?? '3600000', 10)

export async function reconcileRunning(
  state: OrchestratorState,
  deps: OrchestratorDeps
): Promise<void> {
  // CRITICAL: all checks in parallel, never serial
  await Promise.all(
    [...state.running.entries()].map(async ([cardId, { run, abortController }]) => {
      // 1. Fetch card's current column
      const card = await deps.db.getCard(cardId)
      if (!card) {
        // Card deleted — cancel
        await deps.anthropic.interruptSession(run.sessionId!)
        await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.cancelled)
        state.running.delete(cardId)
        state.claimed.delete(cardId)
        return
      }

      // 2. If column is terminal or inactive → cancel
      if (card.column.isTerminalState || !card.column.isActiveState) {
        abortController.abort()
        await deps.anthropic.interruptSession(run.sessionId!)
        await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.cancelled)
        state.running.delete(cardId)
        state.claimed.delete(cardId)
        return
      }

      // 3. Check session status
      if (run.sessionId) {
        const session = await deps.anthropic.retrieveSession(run.sessionId)
        if (session.status === 'terminated') {
          if (session.outcome === 'success') {
            await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.completed)
            state.running.delete(cardId)
            state.claimed.delete(cardId)
          } else {
            await scheduleRetry(run, deps.db)
            state.running.delete(cardId)
            state.claimed.delete(cardId)
          }
          return
        }
        // running/idle → agent runner handling it, no-op
      }

      // 4. Stall detection
      const stalledMs = Date.now() - run.updatedAt.getTime()
      if (stalledMs > MAX_STALL_MS) {
        await deps.anthropic.interruptSession(run.sessionId!)
        await scheduleRetry(run, deps.db)
        state.running.delete(cardId)
        state.claimed.delete(cardId)
      }
    })
  )
}
