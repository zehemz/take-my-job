/**
 * Verifies that every broadcaster.emit call is also persisted to RunEvent via
 * db.insertRunEvent — the mechanism that makes SSE work across serverless
 * function invocations on Vercel.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { handleEvent, type EventHandlerContext } from '../agent-runner/event-handler.js'
import { handleUpdateCard, type UpdateCardContext } from '../agent-runner/tools.js'
import { run } from '../agent-runner.js'
import { StubDbQueries } from '../stubs/db-queries.stub.js'
import { StubBroadcaster } from '../stubs/broadcaster.stub.js'
import { StubAnthropicClient } from '../stubs/anthropic-client.stub.js'
import { AgentRunStatus } from '../types.js'
import type { AgentConfig, AgentRun, Card, Column } from '../types.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const activeCol: Column = {
  id: 'col-active', boardId: 'board-1', name: 'In Progress',
  position: 1, isActiveState: true, isTerminalState: false,
}
const terminalCol: Column = {
  id: 'col-done', boardId: 'board-1', name: 'Done',
  position: 2, isActiveState: false, isTerminalState: true,
}

function makeCard(): Card & { column: Column } {
  return {
    id: 'card-1', boardId: 'board-1', columnId: activeCol.id,
    title: 'Test', description: null, acceptanceCriteria: null,
    role: 'backend_engineer', position: 0, githubRepoUrl: null,
    githubBranch: null, createdAt: new Date(), updatedAt: new Date(),
    column: activeCol,
  }
}

function makeRun(): AgentRun {
  return {
    id: 'run-1', cardId: 'card-1', columnId: activeCol.id,
    role: 'backend_engineer', sessionId: null,
    status: AgentRunStatus.pending, output: null, criteriaResults: null,
    blockedReason: null, attempt: 1, retryAfterMs: null, error: null,
    createdAt: new Date(), updatedAt: new Date(),
  }
}

function makeEventCtx(db: StubDbQueries, broadcaster: StubBroadcaster): EventHandlerContext {
  return {
    card: makeCard(),
    run: makeRun(),
    boardColumns: [activeCol, terminalCol],
    db,
    broadcaster,
    anthropicClient: new StubAnthropicClient(),
    sessionId: 'sess-1',
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    turnCount: { value: 0 },
  }
}

function makeToolCtx(db: StubDbQueries, broadcaster: StubBroadcaster): UpdateCardContext {
  return {
    card: makeCard(),
    run: makeRun(),
    boardColumns: [activeCol, terminalCol],
    db,
    broadcaster,
    sessionId: 'sess-1',
  }
}

// ---------------------------------------------------------------------------
// handleEvent — event-handler.ts
// ---------------------------------------------------------------------------

describe('handleEvent — dual emit (broadcaster + DB)', () => {
  let db: StubDbQueries
  let broadcaster: StubBroadcaster

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    broadcaster = new StubBroadcaster()
    // appendAgentRunOutput needs the run to exist
    db.agentRuns.push(makeRun())
    db.columns.push(activeCol, terminalCol)
    db.cards.push(makeCard())
  })

  it('agent.message — persisted to db and emitted to broadcaster', async () => {
    const ctx = makeEventCtx(db, broadcaster)
    await handleEvent({ type: 'agent.message', content: 'hello world' }, ctx)

    expect(broadcaster.emitted).toHaveLength(1)
    expect(broadcaster.emitted[0].event).toMatchObject({ type: 'agent_message', text: 'hello world' })

    expect(db.runEvents).toHaveLength(1)
    expect(db.runEvents[0].event).toMatchObject({ type: 'agent_message', text: 'hello world' })
    expect(db.runEvents[0].cardId).toBe('card-1')
    expect(db.runEvents[0].runId).toBe('run-1')
  })

  it('agent.thinking — persisted to db and emitted to broadcaster', async () => {
    const ctx = makeEventCtx(db, broadcaster)
    await handleEvent({ type: 'agent.thinking', content: 'let me think...' }, ctx)

    expect(broadcaster.emitted[0].event).toMatchObject({ type: 'agent_thinking', thinking: 'let me think...' })
    expect(db.runEvents[0].event).toMatchObject({ type: 'agent_thinking', thinking: 'let me think...' })
  })

  it('agent.tool_use — persisted to db and emitted to broadcaster', async () => {
    const ctx = makeEventCtx(db, broadcaster)
    await handleEvent({ type: 'agent.tool_use', toolName: 'bash', input: { cmd: 'ls' } }, ctx)

    expect(broadcaster.emitted[0].event).toMatchObject({ type: 'tool_use', tool_name: 'bash' })
    expect(db.runEvents[0].event).toMatchObject({ type: 'tool_use', tool_name: 'bash' })
  })

  it('non-emitting event (span.model_request_end) — nothing written', async () => {
    const ctx = makeEventCtx(db, broadcaster)
    await handleEvent({ type: 'span.model_request_end', usage: { inputTokens: 10, outputTokens: 20 } }, ctx)

    expect(broadcaster.emitted).toHaveLength(0)
    expect(db.runEvents).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// handleUpdateCard — tools.ts
// ---------------------------------------------------------------------------

describe('handleUpdateCard — dual emit (broadcaster + DB)', () => {
  let db: StubDbQueries
  let broadcaster: StubBroadcaster

  beforeEach(() => {
    StubDbQueries.resetIdCounter()
    db = new StubDbQueries()
    broadcaster = new StubBroadcaster()
    db.agentRuns.push(makeRun())
    db.columns.push(activeCol, terminalCol)
    db.cards.push(makeCard())
  })

  it('in_progress — one card_update event persisted', async () => {
    const ctx = makeToolCtx(db, broadcaster)
    await handleUpdateCard({ status: 'in_progress', summary: 'Working on it' }, ctx)

    expect(db.runEvents).toHaveLength(1)
    expect(db.runEvents[0].event).toMatchObject({ type: 'card_update', status: 'in_progress', summary: 'Working on it' })
    expect(broadcaster.emitted).toHaveLength(1)
  })

  it('completed — card_update + status_change both persisted', async () => {
    const ctx = makeToolCtx(db, broadcaster)
    await handleUpdateCard({ status: 'completed', summary: 'All done', criteria_results: [] }, ctx)

    expect(db.runEvents).toHaveLength(2)
    expect(db.runEvents[0].event).toMatchObject({ type: 'card_update', status: 'completed' })
    expect(db.runEvents[1].event).toMatchObject({ type: 'status_change', status: AgentRunStatus.completed })
    expect(broadcaster.emitted).toHaveLength(2)
  })

  it('completed — card_updated written to board events (not card events)', async () => {
    const ctx = makeToolCtx(db, broadcaster)
    await handleUpdateCard({ status: 'completed', summary: 'Done', criteria_results: [] }, ctx)

    // Board event written with column info
    expect(db.boardEvents).toHaveLength(1)
    expect(db.boardEvents[0].boardId).toBe('board-1')
    expect(db.boardEvents[0].event).toMatchObject({
      type: 'card_updated',
      cardId: 'card-1',
      columnId: terminalCol.id,
      columnName: terminalCol.name,
    })

    // card_updated does NOT appear in the card-level run events
    const cardEventTypes = db.runEvents.map((e) => e.event.type)
    expect(cardEventTypes).not.toContain('card_updated')
  })

  it('blocked — card_blocked event persisted with reason', async () => {
    const ctx = makeToolCtx(db, broadcaster)
    await handleUpdateCard({ status: 'blocked', summary: 'Stuck', blocked_reason: 'Missing token' }, ctx)

    expect(db.runEvents).toHaveLength(1)
    expect(db.runEvents[0].event).toMatchObject({ type: 'card_blocked', reason: 'Missing token' })
    expect(broadcaster.emitted).toHaveLength(1)
  })

  it('broadcaster and db receive identical event payloads', async () => {
    const ctx = makeToolCtx(db, broadcaster)
    await handleUpdateCard({ status: 'in_progress', summary: 'step 1' }, ctx)

    const broadcasted = broadcaster.emitted[0].event
    const persisted = db.runEvents[0].event
    expect(persisted).toEqual(broadcasted)
  })
})

// ---------------------------------------------------------------------------
// agent-runner — done event emitted in finally block
// ---------------------------------------------------------------------------

describe('run() — done event', () => {
  const agentConfig: AgentConfig = {
    id: 'cfg-1', role: 'backend_engineer',
    anthropicAgentId: 'agent-1', anthropicAgentVersion: '1',
    anthropicEnvironmentId: 'env-1', createdAt: new Date(),
  }

  it('persists done event after session terminates normally', async () => {
    const db = new StubDbQueries()
    const anthropic = new StubAnthropicClient()
    const broadcaster = new StubBroadcaster()

    db.agentConfigs.push(agentConfig)
    db.columns.push(activeCol, terminalCol)
    db.cards.push(makeCard())
    const agentRun = makeRun()
    db.agentRuns.push(agentRun)

    // Stream terminates immediately
    anthropic.queue.push([{ type: 'session.status_terminated', outcome: 'success' }])

    await run(makeCard(), agentRun, { db, anthropicClient: anthropic, broadcaster })

    const doneInDb = db.runEvents.filter((e) => e.event.type === 'done')
    expect(doneInDb).toHaveLength(1)
    expect(doneInDb[0].cardId).toBe('card-1')

    const doneInBroadcaster = broadcaster.emitted.filter((e) => e.event.type === 'done')
    expect(doneInBroadcaster).toHaveLength(1)
  })

  it('persists done event even when run throws', async () => {
    const db = new StubDbQueries()
    const anthropic = new StubAnthropicClient()
    const broadcaster = new StubBroadcaster()

    // Intentionally omit agentConfig so run() throws "No AgentConfig found"
    db.columns.push(activeCol)
    db.cards.push(makeCard())
    const agentRun = makeRun()
    db.agentRuns.push(agentRun)

    await run(makeCard(), agentRun, { db, anthropicClient: anthropic, broadcaster })

    // run() catches the error internally, then finally fires done
    const doneInDb = db.runEvents.filter((e) => e.event.type === 'done')
    expect(doneInDb).toHaveLength(1)
  })
})
