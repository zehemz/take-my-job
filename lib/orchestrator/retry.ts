import type { AgentRun } from '../types'
import { AgentRunStatus } from '../types'
import type { IDbQueries } from '../interfaces'
import { config } from '../config'

export async function scheduleRetry(run: AgentRun, db: IDbQueries): Promise<void> {
  if (run.attempt >= config.MAX_ATTEMPTS) {
    // Permanent failure — no more retries
    await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
      error: `Exceeded max attempts (${config.MAX_ATTEMPTS})`
    })
    return
  }

  const delay = Math.min(10_000 * Math.pow(2, run.attempt - 1), config.MAX_RETRY_BACKOFF_MS)

  await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
    retryAfterMs: Date.now() + delay,
    error: `Attempt ${run.attempt} failed; retry in ${delay}ms`
  })
}
