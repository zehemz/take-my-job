import { describe, it, expect, beforeEach } from 'vitest'
import { scheduleRetry } from '../orchestrator/retry.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import type { AgentRun } from '../types.js'

function makeRun(attempt: number): AgentRun {
  return {
    id: 'run-1',
    cardId: 'card-1',
    columnId: 'col-1',
    role: 'developer',
    sessionId: null,
    status: 'running',
    output: null,
    criteriaResults: null,
    blockedReason: null,
    attempt,
    retryAfterMs: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('scheduleRetry', () => {
  let db: StubDbQueries

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    // Seed a matching agent run so updateAgentRunStatus can find it
    db.agentRuns.push(makeRun(1))
  })

  it('attempt=1 → status=failed, retryAfterMs ≈ now+10_000', async () => {
    const run = makeRun(1)
    db.agentRuns[0] = run
    const before = Date.now()
    await scheduleRetry(run, db)
    const after = Date.now()

    expect(run.status).toBe('failed')
    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 10_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 10_000 + 500)
  })

  it('attempt=2 → retryAfterMs ≈ now+20_000', async () => {
    const run = makeRun(2)
    db.agentRuns[0] = run
    const before = Date.now()
    await scheduleRetry(run, db)
    const after = Date.now()

    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 20_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 20_000 + 500)
  })

  it('attempt=3 → retryAfterMs ≈ now+40_000', async () => {
    const run = makeRun(3)
    db.agentRuns[0] = run
    const before = Date.now()
    await scheduleRetry(run, db)
    const after = Date.now()

    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 40_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 40_000 + 500)
  })

  it('attempt=4 → retryAfterMs ≈ now+80_000', async () => {
    const run = makeRun(4)
    db.agentRuns[0] = run
    const before = Date.now()
    await scheduleRetry(run, db)
    const after = Date.now()

    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 80_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 80_000 + 500)
  })

  it('attempt=5 → retryAfterMs ≈ now+160_000', async () => {
    const run = makeRun(5)
    db.agentRuns[0] = run
    const before = Date.now()
    await scheduleRetry(run, db)
    const after = Date.now()

    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 160_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 160_000 + 500)
  })

  it('attempt=6 → capped at 300_000', async () => {
    const origMax = process.env.MAX_ATTEMPTS
    process.env.MAX_ATTEMPTS = '10'

    const mod = await import('../orchestrator/retry.js?attempt_capped')

    const run = makeRun(6)
    db.agentRuns[0] = run
    const before = Date.now()
    await mod.scheduleRetry(run, db)
    const after = Date.now()

    const retry = Number(run.retryAfterMs!)
    expect(retry).toBeGreaterThanOrEqual(before + 300_000 - 500)
    expect(retry).toBeLessThanOrEqual(after + 300_000 + 500)

    if (origMax === undefined) {
      delete process.env.MAX_ATTEMPTS
    } else {
      process.env.MAX_ATTEMPTS = origMax
    }
  })

  it('attempt > MAX_ATTEMPTS → status=failed, retryAfterMs=null, error contains "Exceeded"', async () => {
    // Override MAX_ATTEMPTS to 3 for this test
    const origMax = process.env.MAX_ATTEMPTS
    process.env.MAX_ATTEMPTS = '3'

    // Re-import to pick up the new env value
    // Since the module caches the value at import time, we need to reset the module
    const mod = await import('../orchestrator/retry.js?attempt_exceeded')

    const run = makeRun(4)
    db.agentRuns[0] = run
    await mod.scheduleRetry(run, db)

    expect(run.status).toBe('failed')
    expect(run.retryAfterMs).toBeNull()
    expect(run.error).toContain('Exceeded')

    // Restore
    if (origMax === undefined) {
      delete process.env.MAX_ATTEMPTS
    } else {
      process.env.MAX_ATTEMPTS = origMax
    }
  })

  it('retryAfterMs is always set (not null) when retrying', async () => {
    for (const attempt of [1, 2, 3, 4, 5]) {
      const run = makeRun(attempt)
      db.agentRuns[0] = run
      await scheduleRetry(run, db)
      expect(run.retryAfterMs).not.toBeNull()
    }
  })
})
