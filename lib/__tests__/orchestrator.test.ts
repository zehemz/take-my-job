import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Orchestrator } from '../orchestrator.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'
import { StubBroadcaster } from '../stubs/broadcaster.stub.js'
import { AgentRunStatus } from '../types.js'
import type { Card, AgentRun, Column } from '../types.js'

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col-1',
    boardId: 'board-1',
    name: 'Column',
    position: 0,
    isActiveState: true,
    isTerminalState: false,
    columnType: 'active',
    ...overrides,
  }
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    boardId: 'board-1',
    columnId: 'col-1',
    title: 'Test Card',
    description: null,
    acceptanceCriteria: null,
    role: null,
    position: 0,
    githubRepoUrl: null,
    githubBranch: null,
    requiresApproval: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run-1',
    cardId: 'card-1',
    columnId: 'col-1',
    role: 'developer',
    sessionId: 'sess-1',
    status: AgentRunStatus.running,
    output: null,
    criteriaResults: null,
    blockedReason: null,
    attempt: 1,
    retryAfterMs: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('Orchestrator', () => {
  let db: StubDbQueries
  let anthropic: StubAnthropicClient
  let broadcaster: StubBroadcaster
  let spawned: Array<{ card: Card; run: AgentRun }>
  let spawnRunner: (card: Card, run: AgentRun) => void
  let orch: Orchestrator

  beforeEach(() => {
    process.env.POLL_INTERVAL_MS = '9999999'
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    anthropic = new StubAnthropicClient()
    broadcaster = new StubBroadcaster()
    spawned = []
    spawnRunner = (card: Card, run: AgentRun) => {
      spawned.push({ card, run })
    }
    orch = new Orchestrator({ db, anthropic, broadcaster }, spawnRunner, () => {})
  })

  afterEach(() => {
    orch.stop()
    delete process.env.POLL_INTERVAL_MS
  })

  // ── notifyCardMoved ──────────────────────────────────────────

  describe('notifyCardMoved', () => {
    it('interrupts and cancels when card moves to terminal column', async () => {
      const col = makeColumn({ id: 'col-done', isTerminalState: true, isActiveState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-done' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1' })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      const state = (orch as any).state
      state.running.set('card-1', { run, abortController: new AbortController() })
      state.claimed.add('card-1')

      await orch.notifyCardMoved('card-1', 'col-done')

      expect(anthropic.interruptedSessions).toContain('sess-1')
      expect(run.status).toBe('cancelled')
      expect(state.running.has('card-1')).toBe(false)
      expect(state.claimed.has('card-1')).toBe(false)
    })

    it('interrupts and cancels when card moves to inactive (non-terminal) column', async () => {
      const col = makeColumn({ id: 'col-backlog', isTerminalState: false, isActiveState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-backlog' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1' })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      const state = (orch as any).state
      state.running.set('card-1', { run, abortController: new AbortController() })
      state.claimed.add('card-1')

      await orch.notifyCardMoved('card-1', 'col-backlog')

      expect(anthropic.interruptedSessions).toContain('sess-1')
      expect(run.status).toBe('cancelled')
      expect(state.running.has('card-1')).toBe(false)
      expect(state.claimed.has('card-1')).toBe(false)
    })

    it('does nothing when card moves to active column', async () => {
      const col = makeColumn({ id: 'col-wip', isTerminalState: false, isActiveState: true })
      const card = makeCard({ id: 'card-1', columnId: 'col-wip' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1' })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      const state = (orch as any).state
      state.running.set('card-1', { run, abortController: new AbortController() })
      state.claimed.add('card-1')

      await orch.notifyCardMoved('card-1', 'col-wip')

      expect(anthropic.interruptedSessions).toEqual([])
      expect(run.status).toBe('running')
      expect(state.running.has('card-1')).toBe(true)
      expect(state.claimed.has('card-1')).toBe(true)
    })

    it('does not error when card is not in running map', async () => {
      const col = makeColumn({ id: 'col-done', isTerminalState: true, isActiveState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-done' })

      db.columns.push(col)
      db.cards.push(card)

      await expect(orch.notifyCardMoved('card-1', 'col-done')).resolves.toBeUndefined()
      expect(anthropic.interruptedSessions).toEqual([])
    })

    it('cancels run but does not call interruptSession when sessionId is null', async () => {
      const col = makeColumn({ id: 'col-done', isTerminalState: true, isActiveState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-done' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: null })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      const state = (orch as any).state
      state.running.set('card-1', { run, abortController: new AbortController() })
      state.claimed.add('card-1')

      await orch.notifyCardMoved('card-1', 'col-done')

      expect(anthropic.interruptedSessions).toEqual([])
      expect(run.status).toBe('cancelled')
      expect(state.running.has('card-1')).toBe(false)
      expect(state.claimed.has('card-1')).toBe(false)
    })
  })

  // ── start() — startup recovery ───────────────────────────────

  describe('start() — startup recovery', () => {
    it('re-attaches and spawns run with live session', async () => {
      const col = makeColumn({ id: 'col-active', isActiveState: true, isTerminalState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-active' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      anthropic.configureDefaultSession({ status: AgentRunStatus.running })

      await orch.start()

      expect(spawned).toHaveLength(1)
      expect(spawned[0].card.id).toBe('card-1')
      expect(spawned[0].run.id).toBe('run-1')

      const state = (orch as any).state
      expect(state.claimed.has('card-1')).toBe(true)
      expect(state.running.has('card-1')).toBe(true)
    })

    it('marks run as completed when session terminated with success', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running })
      db.agentRuns.push(run)

      // Default stub already returns terminated + success
      await orch.start()

      expect(run.status).toBe('completed')
      expect(spawned).toHaveLength(0)

      const state = (orch as any).state
      expect(state.running.has('card-1')).toBe(false)
    })

    it('schedules retry when session terminated with error', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running, attempt: 1 })
      db.agentRuns.push(run)

      anthropic.configureDefaultSession({ status: 'terminated', outcome: 'error' })

      await orch.start()

      expect(run.status).toBe('failed')
      expect(run.retryAfterMs).not.toBeNull()
      expect(spawned).toHaveLength(0)

      const state = (orch as any).state
      expect(state.running.has('card-1')).toBe(false)
    })

    it('schedules retry when run has no sessionId', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: null, status: AgentRunStatus.running, attempt: 1 })
      db.agentRuns.push(run)

      await orch.start()

      expect(run.status).toBe('failed')
      expect(run.retryAfterMs).not.toBeNull()
      expect(spawned).toHaveLength(0)
    })

    it('resets retryAfterMs for retry-eligible runs', async () => {
      const pastMs = Date.now() - 1000
      const run = makeRun({
        id: 'run-1',
        cardId: 'card-1',
        status: AgentRunStatus.failed,
        sessionId: null,
        retryAfterMs: BigInt(pastMs),
        attempt: 1,
      })
      db.agentRuns.push(run)

      const beforeStart = Date.now()
      await orch.start()

      expect(Number(run.retryAfterMs)).toBeGreaterThanOrEqual(beforeStart)
      expect(Number(run.retryAfterMs)).toBeLessThanOrEqual(Date.now())
    })

    it('completes recovery before poll loop fires', async () => {
      const col = makeColumn({ id: 'col-active', isActiveState: true, isTerminalState: false })
      const card = makeCard({ id: 'card-1', columnId: 'col-active' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      anthropic.configureDefaultSession({ status: AgentRunStatus.running })

      // After start() resolves, recovery must be complete — poll hasn't fired yet
      await orch.start()

      const state = (orch as any).state
      expect(state.running.has('card-1')).toBe(true)
      expect(state.claimed.has('card-1')).toBe(true)
      expect(spawned).toHaveLength(1)
    })
  })
})
