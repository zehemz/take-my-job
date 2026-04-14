import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reconcileRunning } from '../orchestrator/reconcile.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'
import { AgentRunStatus } from '../types.js'
import type { AgentRun, Column } from '../types.js'
import type { OrchestratorState, OrchestratorDeps } from '../orchestrator/types.js'

function makeRun(overrides?: Partial<AgentRun>): AgentRun {
  return {
    id: 'run-1', cardId: 'card-1', columnId: 'col-1', role: 'backend_engineer',
    sessionId: 'session-1', status: AgentRunStatus.running, output: null, criteriaResults: null,
    blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  }
}

function makeRunningEntry(run: AgentRun) {
  return { run, abortController: new AbortController() }
}

const activeCol: Column = {
  id: 'col-active', boardId: 'board-1', name: 'In Progress',
  position: 1, isActiveState: true, isTerminalState: false, columnType: 'active',
}
const terminalCol: Column = {
  id: 'col-terminal', boardId: 'board-1', name: 'Done',
  position: 2, isActiveState: false, isTerminalState: true, columnType: 'terminal',
}
const inactiveCol: Column = {
  id: 'col-inactive', boardId: 'board-1', name: 'Backlog',
  position: 0, isActiveState: false, isTerminalState: false, columnType: 'inactive',
}

describe('reconcileRunning', () => {
  let db: StubDbQueries
  let anthropic: StubAnthropicClient
  let state: OrchestratorState
  let deps: OrchestratorDeps

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    anthropic = new StubAnthropicClient()
    state = { running: new Map(), claimed: new Set() }
    deps = {
      db,
      anthropic,
      broadcaster: { emit: vi.fn(), subscribe: vi.fn(() => () => {}) },
    }
    db.columns.push(activeCol, terminalCol, inactiveCol)
  })

  it('terminal column → interruptSession, status=cancelled, removed from running+claimed', async () => {
    const run = makeRun({ columnId: 'col-terminal' })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-terminal',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    const entry = makeRunningEntry(run)
    state.running.set('card-1', entry)
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('cancelled')
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('inactive column → interruptSession, status=cancelled, removed from running+claimed', async () => {
    const run = makeRun({ columnId: 'col-inactive' })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-inactive',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    const entry = makeRunningEntry(run)
    state.running.set('card-1', entry)
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('cancelled')
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('card deleted → interruptSession, status=cancelled, removed from running+claimed', async () => {
    const run = makeRun()
    db.agentRuns.push(run)
    // No card seeded in db — getCard returns null
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('cancelled')
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('session terminated success → status=completed, removed from running+claimed', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-active',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'terminated', outcome: 'success' })
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(run.status).toBe('completed')
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('session terminated error → scheduleRetry called, status=failed with retryAfterMs, removed', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-active',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'terminated', outcome: 'error' })
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(run.status).toBe('failed')
    expect(run.retryAfterMs).not.toBeNull()
    expect(run.error).toBeTruthy()
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('session running → no status change, still in running map', async () => {
    const run = makeRun({ columnId: 'col-active' })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-active',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'running' })
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(run.status).toBe('running')
    expect(state.running.has('card-1')).toBe(true)
    expect(state.claimed.has('card-1')).toBe(true)
  })

  it('stall detection — updatedAt 2 hours ago → interruptSession + scheduleRetry, removed', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const run = makeRun({ columnId: 'col-active', updatedAt: twoHoursAgo })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-active',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'running' })
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(anthropic.interruptedSessions).toContain('session-1')
    expect(run.status).toBe('failed')
    expect(run.retryAfterMs).not.toBeNull()
    expect(state.running.has('card-1')).toBe(false)
    expect(state.claimed.has('card-1')).toBe(false)
  })

  it('no stall — updatedAt 30 minutes ago → no interrupt, still in running map', async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const run = makeRun({ columnId: 'col-active', updatedAt: thirtyMinAgo })
    db.agentRuns.push(run)
    db.cards.push({
      id: 'card-1', boardId: 'board-1', columnId: 'col-active',
      title: 'Test', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'running' })
    state.running.set('card-1', makeRunningEntry(run))
    state.claimed.add('card-1')

    await reconcileRunning(state, deps)

    expect(anthropic.interruptedSessions).toHaveLength(0)
    expect(run.status).toBe('running')
    expect(state.running.has('card-1')).toBe(true)
    expect(state.claimed.has('card-1')).toBe(true)
  })

  it('parallel execution — 3 cards all processed via Promise.all', async () => {
    // Card A: terminal column → cancelled
    const runA = makeRun({ id: 'run-a', cardId: 'card-a', columnId: 'col-terminal', sessionId: 'sess-a' })
    db.agentRuns.push(runA)
    db.cards.push({
      id: 'card-a', boardId: 'board-1', columnId: 'col-terminal',
      title: 'A', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })

    // Card B: deleted → cancelled
    const runB = makeRun({ id: 'run-b', cardId: 'card-b', columnId: 'col-active', sessionId: 'sess-b' })
    db.agentRuns.push(runB)
    // No card-b in db

    // Card C: active column, session running → stays in running
    const runC = makeRun({ id: 'run-c', cardId: 'card-c', columnId: 'col-active', sessionId: 'sess-c' })
    db.agentRuns.push(runC)
    db.cards.push({
      id: 'card-c', boardId: 'board-1', columnId: 'col-active',
      title: 'C', description: null, acceptanceCriteria: null, role: null, position: 2, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date(),
    })
    anthropic.configureDefaultSession({ status: 'running' })

    state.running.set('card-a', makeRunningEntry(runA))
    state.running.set('card-b', makeRunningEntry(runB))
    state.running.set('card-c', makeRunningEntry(runC))
    state.claimed.add('card-a')
    state.claimed.add('card-b')
    state.claimed.add('card-c')

    const getCardSpy = vi.spyOn(db, 'getCard')

    await reconcileRunning(state, deps)

    // All 3 getCard calls were made
    expect(getCardSpy).toHaveBeenCalledTimes(3)
    expect(getCardSpy).toHaveBeenCalledWith('card-a')
    expect(getCardSpy).toHaveBeenCalledWith('card-b')
    expect(getCardSpy).toHaveBeenCalledWith('card-c')

    // Card A and B cancelled, C stays
    expect(runA.status).toBe('cancelled')
    expect(runB.status).toBe('cancelled')
    expect(runC.status).toBe('running')

    expect(state.running.has('card-a')).toBe(false)
    expect(state.running.has('card-b')).toBe(false)
    expect(state.running.has('card-c')).toBe(true)
  })

  it('abortController.abort() called on terminal and inactive columns', async () => {
    const runTerminal = makeRun({ id: 'run-t', cardId: 'card-t', columnId: 'col-terminal', sessionId: 'sess-t' })
    const runInactive = makeRun({ id: 'run-i', cardId: 'card-i', columnId: 'col-inactive', sessionId: 'sess-i' })
    db.agentRuns.push(runTerminal, runInactive)
    db.cards.push(
      { id: 'card-t', boardId: 'board-1', columnId: 'col-terminal', title: 'T', description: null, acceptanceCriteria: null, role: null, position: 0, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'card-i', boardId: 'board-1', columnId: 'col-inactive', title: 'I', description: null, acceptanceCriteria: null, role: null, position: 1, githubRepoUrl: null, githubBranch: null, requiresApproval: false, createdAt: new Date(), updatedAt: new Date() },
    )

    const entryT = makeRunningEntry(runTerminal)
    const entryI = makeRunningEntry(runInactive)
    state.running.set('card-t', entryT)
    state.running.set('card-i', entryI)
    state.claimed.add('card-t')
    state.claimed.add('card-i')

    await reconcileRunning(state, deps)

    expect(entryT.abortController.signal.aborted).toBe(true)
    expect(entryI.abortController.signal.aborted).toBe(true)
  })
})
