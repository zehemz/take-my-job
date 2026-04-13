import { AgentRunStatus } from '../types.js'
import type { AgentRun } from '../types.js'
import type { IDbQueries } from '../interfaces.js'

const MAX_RETRY_BACKOFF_MS = parseInt(process.env.MAX_RETRY_BACKOFF_MS ?? '300000', 10) // 5 minutes
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS ?? '5', 10)

export async function scheduleRetry(run: AgentRun, db: IDbQueries): Promise<void> {
  if (run.attempt > MAX_ATTEMPTS) {
    // Permanent failure — no more retries
    await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
      error: `Exceeded max attempts (${MAX_ATTEMPTS})`
    })
    return
  }

  const delay = Math.min(10_000 * Math.pow(2, run.attempt - 1), MAX_RETRY_BACKOFF_MS)

  await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
    retryAfterMs: Date.now() + delay,
    error: `Attempt ${run.attempt} failed; retry in ${delay}ms`
  })
}
