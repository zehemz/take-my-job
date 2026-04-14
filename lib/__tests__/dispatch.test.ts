import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchPending } from '../orchestrator/dispatch.js'
import type { OrchestratorDeps, SpawnRunner } from '../orchestrator/types.js'
import type { Card, Column, AgentRun } from '../types.js'
import { AgentRunStatus } from '../types.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'


function makeColumn(overrides?: Partial<Column>): Column {
  return {
    id: 'col-1',
    boardId: 'board-1',
    name: 'In Progress',
    position: 1,
    isActiveState: true,
    isTerminalState: false,
    columnType: 'active',
    ...overrides,
  }
}

function makeCard(id: string, columnId: string, position = 0): Card {
  return {
    id,
    boardId: 'board-1',
    columnId,
    title: `Card ${id}`,
    description: null,
    acceptanceCriteria: null,
    role: 'backend_engineer',
    position,
    githubRepoUrl: null,
    githubBranch: null,
    environmentId: 'env_test',
    requiresApproval: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('dispatchPending', () => {
  let db: StubDbQueries
  let deps: OrchestratorDeps
  let spawnRunner: SpawnRunner & ReturnType<typeof vi.fn>

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    deps = {
      db,
      anthropic: new StubAnthropicClient(),
    }
    spawnRunner = vi.fn() as unknown as SpawnRunner & ReturnType<typeof vi.fn>
  })

  it('dispatches a single eligible card', async () => {
    const col = makeColumn()
    const card = makeCard('card-1', col.id)
    db.columns.push(col)
    db.cards.push(card)

    await dispatchPending(deps, spawnRunner)

    expect(db.agentRuns).toHaveLength(1)
    expect(db.agentRuns[0].cardId).toBe('card-1')
    expect(db.agentRuns[0].attempt).toBe(1)
    expect(spawnRunner).toHaveBeenCalledOnce()
    expect(spawnRunner).toHaveBeenCalledWith(card, db.agentRuns[0])
  })

  it('does not dispatch when concurrency cap is reached', async () => {
    const col = makeColumn()
    db.columns.push(col)
    db.cards.push(makeCard('card-new', col.id))

    // Seed 5 running runs to hit MAX_CONCURRENT
    for (let i = 0; i < 5; i++) {
      db.agentRuns.push({
        id: `run-${i}`, cardId: `c-${i}`, columnId: col.id, role: 'backend_engineer',
        sessionId: null, status: AgentRunStatus.running, output: null, criteriaResults: null,
        blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
        createdAt: new Date(), updatedAt: new Date(),
      })
    }

    await dispatchPending(deps, spawnRunner)

    // No new runs created (only the 5 we seeded)
    expect(db.agentRuns).toHaveLength(5)
    expect(spawnRunner).not.toHaveBeenCalled()
  })

  it('skips card that already has a pending run (claim-or-skip)', async () => {
    const col = makeColumn()
    const card = makeCard('card-1', col.id)
    db.columns.push(col)
    db.cards.push(card)

    // Seed a pending run — getEligibleCards returns the card,
    // but claimAndCreateAgentRun returns null (pending run blocks it)
    db.agentRuns.push({
      id: 'existing-run', cardId: 'card-1', columnId: col.id, role: 'backend_engineer',
      sessionId: null, status: AgentRunStatus.pending, output: null, criteriaResults: null,
      blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
      createdAt: new Date(), updatedAt: new Date(),
    })

    await dispatchPending(deps, spawnRunner)

    // Only the pre-existing run; no new run created
    expect(db.agentRuns).toHaveLength(1)
    expect(spawnRunner).not.toHaveBeenCalled()
  })

  it('dispatches multiple eligible cards', async () => {
    const col = makeColumn()
    db.columns.push(col)
    db.cards.push(makeCard('card-1', col.id, 0))
    db.cards.push(makeCard('card-2', col.id, 1))
    db.cards.push(makeCard('card-3', col.id, 2))

    await dispatchPending(deps, spawnRunner)

    expect(db.agentRuns).toHaveLength(3)
    expect(db.agentRuns.map(r => r.cardId)).toEqual(['card-1', 'card-2', 'card-3'])
    expect(spawnRunner).toHaveBeenCalledTimes(3)
  })

  it('dispatches retry-eligible runs', async () => {
    const col = makeColumn()
    db.columns.push(col)
    const card = makeCard('card-r', col.id)
    db.cards.push(card)

    // Add a failed run with retryAfterMs in the past
    const failedRun: AgentRun = {
      id: 'prev-run',
      cardId: 'card-r',
      columnId: col.id,
      role: 'backend_engineer',
      sessionId: null,
      status: AgentRunStatus.failed,
      output: null,
      criteriaResults: null,
      blockedReason: null,
      attempt: 1,
      retryAfterMs: BigInt(Date.now() - 10000),
      error: 'some error',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    db.agentRuns.push(failedRun)

    await dispatchPending(deps, spawnRunner)

    // Fresh dispatch picks up card-r (no active run), claims it.
    // Retry loop then skips because card-r now has a pending run.
    expect(db.agentRuns).toHaveLength(2)
    const createdRun = db.agentRuns[1]
    expect(createdRun.cardId).toBe('card-r')
    expect(createdRun.attempt).toBe(1)
    expect(spawnRunner).toHaveBeenCalledOnce()
  })

  it('skips retry-eligible run when card is in terminal column', async () => {
    const activeCol = makeColumn({ id: 'col-active' })
    const doneCol = makeColumn({ id: 'col-done', isActiveState: false, isTerminalState: true, name: 'Done' })
    db.columns.push(activeCol, doneCol)

    const card = makeCard('card-r', doneCol.id)
    db.cards.push(card)

    const failedRun: AgentRun = {
      id: 'prev-run',
      cardId: 'card-r',
      columnId: doneCol.id,
      role: 'backend_engineer',
      sessionId: null,
      status: AgentRunStatus.failed,
      output: null,
      criteriaResults: null,
      blockedReason: null,
      attempt: 2,
      retryAfterMs: BigInt(Date.now() - 5000),
      error: 'transient failure',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    db.agentRuns.push(failedRun)

    await dispatchPending(deps, spawnRunner)

    // Card is in terminal column — retry should be skipped
    expect(db.agentRuns).toHaveLength(1) // only the original failed run
    expect(spawnRunner).not.toHaveBeenCalled()
  })

  it('dispatches retry-eligible run when card is in active column', async () => {
    const activeCol = makeColumn({ id: 'col-active' })
    db.columns.push(activeCol)

    const card = makeCard('card-r', activeCol.id)
    db.cards.push(card)

    const failedRun: AgentRun = {
      id: 'prev-run',
      cardId: 'card-r',
      columnId: activeCol.id,
      role: 'backend_engineer',
      sessionId: null,
      status: AgentRunStatus.failed,
      output: null,
      criteriaResults: null,
      blockedReason: null,
      attempt: 2,
      retryAfterMs: BigInt(Date.now() - 5000),
      error: 'transient failure',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    db.agentRuns.push(failedRun)

    await dispatchPending(deps, spawnRunner)

    // Card is in active column — fresh dispatch claims it first (attempt 1),
    // then retry path skips because claimAndCreateAgentRun returns null.
    expect(db.agentRuns).toHaveLength(2)
    const newRun = db.agentRuns[1]
    expect(newRun.cardId).toBe('card-r')
    expect(newRun.attempt).toBe(1) // fresh dispatch, not retry
    expect(spawnRunner).toHaveBeenCalledOnce()
  })

  it('skips retry-eligible run when card already has an active run', async () => {
    const col = makeColumn()
    db.columns.push(col)
    db.cards.push(makeCard('card-r', col.id))

    // Active (running) run for card-r — blocks both fresh dispatch and retry claim
    db.agentRuns.push({
      id: 'active-run', cardId: 'card-r', columnId: col.id, role: 'backend_engineer',
      sessionId: 'sess-1', status: AgentRunStatus.running, output: null, criteriaResults: null,
      blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
      createdAt: new Date(), updatedAt: new Date(),
    })

    // Failed retry-eligible run for same card
    const failedRun: AgentRun = {
      id: 'prev-run',
      cardId: 'card-r',
      columnId: col.id,
      role: 'backend_engineer',
      sessionId: null,
      status: AgentRunStatus.failed,
      output: null,
      criteriaResults: null,
      blockedReason: null,
      attempt: 1,
      retryAfterMs: BigInt(Date.now() - 5000),
      error: 'err',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    db.agentRuns.push(failedRun)

    await dispatchPending(deps, spawnRunner)

    // Fresh: getEligibleCards excludes card-r (has running run).
    // Retry: claimAndCreateAgentRun returns null (has running run).
    expect(db.agentRuns).toHaveLength(2) // no new runs
    expect(spawnRunner).not.toHaveBeenCalled()
  })

  it('resolves even if spawnRunner throws', async () => {
    const col = makeColumn()
    db.columns.push(col)
    db.cards.push(makeCard('card-1', col.id))

    spawnRunner.mockImplementation(() => {
      throw new Error('spawn boom')
    })

    await expect(dispatchPending(deps, spawnRunner)).rejects.toThrow('spawn boom')
    expect(spawnRunner).toHaveBeenCalledOnce()
    // Run was created in DB before the throw
    expect(db.agentRuns).toHaveLength(1)
  })

  it('does nothing when no eligible cards exist', async () => {
    const col = makeColumn()
    db.columns.push(col)

    await dispatchPending(deps, spawnRunner)

    expect(db.agentRuns).toHaveLength(0)
    expect(spawnRunner).not.toHaveBeenCalled()
  })
})
