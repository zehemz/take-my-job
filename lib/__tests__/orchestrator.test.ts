import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Orchestrator } from '../orchestrator.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'
import { AgentRunStatus } from '../types.js'
import type { Card, AgentRun, Column } from '../types.js'
import type { SpawnRunner, SpawnResumeRunner } from '../orchestrator/types.js'

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
    environmentId: 'env_test',
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
  let spawned: Array<{ card: Card; run: AgentRun }>
  let resumeSpawned: Array<{ card: Card & { column: Column }; run: AgentRun }>
  let spawnRunner: SpawnRunner
  let spawnResumeRunner: SpawnResumeRunner
  let orch: Orchestrator

  beforeEach(() => {
    process.env.POLL_INTERVAL_MS = '9999999'
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    anthropic = new StubAnthropicClient()
    spawned = []
    resumeSpawned = []
    spawnRunner = (card: Card, run: AgentRun) => {
      spawned.push({ card, run })
    }
    spawnResumeRunner = (card: Card & { column: Column }, run: AgentRun) => {
      resumeSpawned.push({ card, run })
    }
    orch = new Orchestrator({ db, anthropic }, spawnRunner, spawnResumeRunner)
  })

  afterEach(() => {
    orch.stop()
    delete process.env.POLL_INTERVAL_MS
  })

  // ── notifyCardMoved ──────────────────────────────────────────

  describe('notifyCardMoved', () => {
    it('inserts card_moved event when card exists', async () => {
      const col = makeColumn({ id: 'col-active' })
      const card = makeCard({ id: 'card-1', columnId: 'col-active' })

      db.columns.push(col)
      db.cards.push(card)

      await orch.notifyCardMoved('card-1', 'col-active')

      expect(db.orchestratorEvents).toHaveLength(1)
      expect(db.orchestratorEvents[0].type).toBe('card_moved')
      expect(db.orchestratorEvents[0].cardId).toBe('card-1')
      expect(db.orchestratorEvents[0].boardId).toBe('board-1')
      expect(db.orchestratorEvents[0].payload).toEqual({ newColumnId: 'col-active' })
    })

    it('does nothing when card not found', async () => {
      await expect(orch.notifyCardMoved('card-1', 'col-done')).resolves.toBeUndefined()
      expect(db.orchestratorEvents).toHaveLength(0)
    })
  })

  // ── notifyCardUnblocked ─────────────────────────────────────

  describe('notifyCardUnblocked', () => {
    it('inserts card_unblocked event and calls spawnResumeRunner', async () => {
      const col = makeColumn({ id: 'col-active' })
      const card = makeCard({ id: 'card-1', columnId: 'col-active' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1' })

      db.columns.push(col)
      db.cards.push(card)

      await orch.notifyCardUnblocked('card-1', run)

      expect(db.orchestratorEvents).toHaveLength(1)
      expect(db.orchestratorEvents[0].type).toBe('card_unblocked')
      expect(db.orchestratorEvents[0].cardId).toBe('card-1')
      expect(db.orchestratorEvents[0].runId).toBe('run-1')

      expect(resumeSpawned).toHaveLength(1)
      expect(resumeSpawned[0].card.id).toBe('card-1')
      expect(resumeSpawned[0].run.id).toBe('run-1')
    })

    it('does nothing when card not found', async () => {
      const run = makeRun()

      await orch.notifyCardUnblocked('nonexistent', run)

      expect(db.orchestratorEvents).toHaveLength(0)
      expect(resumeSpawned).toHaveLength(0)
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

      anthropic.configureDefaultSession({ status: 'running' })

      await orch.start()

      expect(spawned).toHaveLength(1)
      expect(spawned[0].card.id).toBe('card-1')
      expect(spawned[0].run.id).toBe('run-1')
    })

    it('marks run as completed when session terminated with success', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running })
      db.agentRuns.push(run)

      // Default stub already returns terminated + success
      await orch.start()

      expect(run.status).toBe('completed')
      expect(spawned).toHaveLength(0)
    })

    it('schedules retry when session terminated with error', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.running, attempt: 1 })
      db.agentRuns.push(run)

      anthropic.configureDefaultSession({ status: 'terminated', outcome: 'error' })

      await orch.start()

      expect(run.status).toBe('failed')
      expect(run.retryAfterMs).not.toBeNull()
      expect(spawned).toHaveLength(0)
    })

    it('schedules retry when run has no sessionId', async () => {
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: null, status: AgentRunStatus.running, attempt: 1 })
      db.agentRuns.push(run)

      await orch.start()

      expect(run.status).toBe('failed')
      expect(run.retryAfterMs).not.toBeNull()
      expect(spawned).toHaveLength(0)
    })

    it('skips blocked runs during recovery', async () => {
      const col = makeColumn({ id: 'col-active' })
      const card = makeCard({ id: 'card-1', columnId: 'col-active' })
      const run = makeRun({ id: 'run-1', cardId: 'card-1', sessionId: 'sess-1', status: AgentRunStatus.blocked })

      db.columns.push(col)
      db.cards.push(card)
      db.agentRuns.push(run)

      await orch.start()

      expect(spawned).toHaveLength(0)
      expect(run.status).toBe('blocked')
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

      anthropic.configureDefaultSession({ status: 'running' })

      // After start() resolves, recovery must be complete — poll hasn't fired yet
      await orch.start()

      expect(spawned).toHaveLength(1)
    })
  })
})
