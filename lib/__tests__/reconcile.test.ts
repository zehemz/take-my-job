import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reconcileRunning } from '../orchestrator/reconcile.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'
import { AgentRunStatus } from '../types.js'
import type { AgentRun, Column } from '../types.js'
import type { OrchestratorDeps } from '../orchestrator/types.js'

function makeRun(overrides?: Partial<AgentRun>): AgentRun {
  return {
    id: 'run-1', cardId: 'card-1', columnId: 'col-1', role: 'backend_engineer',
    sessionId: 'session-1', status: AgentRunStatus.running, output: null, criteriaResults: null,
    blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  }
}

function makeCard(id: string, columnId: string) {
  return {
    id, boardId: 'board-1', columnId,
    title: 'Test', description: null, acceptanceCriteria: null, role: null,
    position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false,
    createdAt: new Date(), updatedAt: new Date(),
  }
}

const activeCol: Column = {
  id: 'col-active', boardId: 'board-1', name: 'In Progress',
  position: 1, isActiveState: true, isTerminalState: false, columnType: 'active',
}
const blockedCol: Column = {
  id: 'col-blocked', boardId: 'board-1', name: 'Blocked',
  position: 2, isActiveState: false, isTerminalState: false, columnType: 'blocked',
}
const terminalCol: Column = {
  id: 'col-terminal', boardId: 'board-1', name: 'Done',
  position: 3, isActiveState: false, isTerminalState: true, columnType: 'terminal',
}
const inactiveCol: Column = {
  id: 'col-inactive', boardId: 'board-1', name: 'Backlog',
  position: 0, isActiveState: false, isTerminalState: false, columnType: 'inactive',
}

describe('reconcileRunning', () => {
  let db: StubDbQueries
  let anthropic: StubAnthropicClient
  let deps: OrchestratorDeps

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    anthropic = new StubAnthropicClient()
    deps = {
      db,
      anthropic,
    }
    db.columns.push(activeCol, blockedCol, terminalCol, inactiveCol)
  })

  it('terminal column → interruptSession + status=cancelled', async () => {
    const run = makeRun({ columnId: 'col-terminal' })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-terminal'))

    await reconcileRunning(deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('cancelled')
  })

  it('inactive column → interruptSession + status=cancelled', async () => {
    const run = makeRun({ columnId: 'col-inactive' })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-inactive'))

    await reconcileRunning(deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('cancelled')
  })

  it('card deleted → run not processed (getActiveRuns skips orphaned runs)', async () => {
    const run = makeRun()
    db.agentRuns.push(run)
    // No card seeded — getActiveRuns joins card+column so this run is excluded

    await reconcileRunning(deps)

    expect(run.status).toBe('running')
    expect(anthropic.interruptedSessions).toHaveLength(0)
  })

  it('session terminated success → status=completed', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))
    anthropic.configureDefaultSession({ status: 'terminated', outcome: 'success' })

    await reconcileRunning(deps)

    expect(run.status).toBe('completed')
  })

  it('session terminated error → status=failed with retryAfterMs', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))
    anthropic.configureDefaultSession({ status: 'terminated', outcome: 'error' })

    await reconcileRunning(deps)

    expect(run.status).toBe('failed')
    expect(run.retryAfterMs).not.toBeNull()
    expect(run.error).toBeTruthy()
  })

  it('session running → status unchanged', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))
    anthropic.configureDefaultSession({ status: 'running' })

    await reconcileRunning(deps)

    expect(run.status).toBe('running')
  })

  it('stall detection — updatedAt 2 hours ago → interruptSession + status=failed with retry', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const run = makeRun({ columnId: 'col-active', updatedAt: twoHoursAgo })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))
    anthropic.configureDefaultSession({ status: 'running' })

    await reconcileRunning(deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('failed')
    expect(run.retryAfterMs).not.toBeNull()
  })

  it('no stall — updatedAt 30 minutes ago → no interrupt, status unchanged', async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const run = makeRun({ columnId: 'col-active', updatedAt: thirtyMinAgo })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))
    anthropic.configureDefaultSession({ status: 'running' })

    await reconcileRunning(deps)

    expect(anthropic.interruptedSessions).toHaveLength(0)
    expect(run.status).toBe('running')
  })

  it('parallel execution — 3 cards all processed via Promise.all', async () => {
    // Card A: terminal column → cancelled
    const runA = makeRun({ id: 'run-a', cardId: 'card-a', columnId: 'col-terminal', sessionId: 'sess-a' })
    db.agentRuns.push(runA)
    db.cards.push(makeCard('card-a', 'col-terminal'))

    // Card B: inactive column → cancelled
    const runB = makeRun({ id: 'run-b', cardId: 'card-b', columnId: 'col-inactive', sessionId: 'sess-b' })
    db.agentRuns.push(runB)
    db.cards.push(makeCard('card-b', 'col-inactive'))

    // Card C: active column, session running → no change
    const runC = makeRun({ id: 'run-c', cardId: 'card-c', columnId: 'col-active', sessionId: 'sess-c' })
    db.agentRuns.push(runC)
    db.cards.push(makeCard('card-c', 'col-active'))

    anthropic.configureDefaultSession({ status: 'running' })

    await reconcileRunning(deps)

    expect(runA.status).toBe('cancelled')
    expect(runB.status).toBe('cancelled')
    expect(runC.status).toBe('running')
  })

  it('blocked run → moves card to blocked column, session NOT interrupted', async () => {
    const run = makeRun({ columnId: 'col-active', status: AgentRunStatus.blocked })
    db.agentRuns.push(run)
    db.cards.push(makeCard('card-1', 'col-active'))

    const moveCardSpy = vi.spyOn(db, 'moveCardToColumnType')

    await reconcileRunning(deps)

    expect(moveCardSpy).toHaveBeenCalledWith('card-1', 'board-1', 'blocked')
    expect(anthropic.interruptedSessions).toHaveLength(0)
  })
})
