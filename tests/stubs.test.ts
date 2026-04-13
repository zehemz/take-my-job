import { describe, it, expect } from "vitest";
import { createDbQueriesStub } from "../lib/stubs/db-queries.stub.js";
import { createAnthropicClientStub } from "../lib/stubs/anthropic-client.stub.js";
import { createBroadcasterStub } from "../lib/stubs/broadcaster.stub.js";
import { createOrchestratorStub } from "../lib/stubs/orchestrator.stub.js";
import { AgentRunStatus } from "../lib/types.js";
import type { Card, Column } from "../lib/types.js";

const makeColumn = (overrides: Partial<Column> = {}): Column => ({
  id: "col_1",
  boardId: "board_1",
  name: "In Progress",
  position: 1,
  isActiveState: true,
  isTerminalState: false,
  ...overrides,
});

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: "card_1",
  boardId: "board_1",
  columnId: "col_1",
  title: "Test Card",
  description: null,
  acceptanceCriteria: null,
  role: "backend_engineer",
  position: 0,
  githubRepoUrl: null,
  githubBranch: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("db-queries stub", () => {
  it("returns eligible cards in active columns excluding claimed", async () => {
    const col = makeColumn();
    const card1 = makeCard({ id: "card_1" });
    const card2 = makeCard({ id: "card_2" });
    const db = createDbQueriesStub({ cards: [card1, card2], columns: [col] });

    const eligible = await db.getEligibleCards(5, new Set(["card_1"]));
    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe("card_2");
  });

  it("creates and retrieves agent runs", async () => {
    const db = createDbQueriesStub();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);

    expect(run.status).toBe(AgentRunStatus.pending);
    expect(run.attempt).toBe(1);

    const updated = await db.updateAgentRunStatus(run.id, AgentRunStatus.running, {
      sessionId: "sess_123",
    } as Partial<import("../lib/types.js").AgentRun>);
    expect(updated.status).toBe(AgentRunStatus.running);
    expect(updated.sessionId).toBe("sess_123");
  });

  it("appends output without overwriting", async () => {
    const db = createDbQueriesStub();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);

    await db.appendAgentRunOutput(run.id, "Hello ");
    await db.appendAgentRunOutput(run.id, "World");

    const runs = await db.getRunningRuns();
    // Run is still pending, not running, so getRunningRuns won't return it
    // Let's update it first
    await db.updateAgentRunStatus(run.id, AgentRunStatus.running);
    const runningRuns = await db.getRunningRuns();
    expect(runningRuns).toHaveLength(1);
    expect(runningRuns[0].output).toBe("Hello World");
  });

  it("moves card to new column", async () => {
    const col1 = makeColumn({ id: "col_1", name: "In Progress" });
    const col2 = makeColumn({ id: "col_2", name: "Done", isTerminalState: true, isActiveState: false });
    const card = makeCard({ columnId: "col_1" });
    const db = createDbQueriesStub({ cards: [card], columns: [col1, col2] });

    const moved = await db.moveCard("card_1", "col_2");
    expect(moved.columnId).toBe("col_2");
  });

  it("finds column by name", async () => {
    const col = makeColumn({ name: "Review" });
    const db = createDbQueriesStub({ columns: [col] });

    const found = await db.getColumnByName("board_1", "Review");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Review");

    const notFound = await db.getColumnByName("board_1", "Nonexistent");
    expect(notFound).toBeNull();
  });

  it("returns retry-eligible runs", async () => {
    const db = createDbQueriesStub();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);
    await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
      retryAfterMs: BigInt(Date.now() - 1000),
    } as Partial<import("../lib/types.js").AgentRun>);

    const retryable = await db.getRetryEligibleRuns();
    expect(retryable).toHaveLength(1);
    expect(retryable[0].id).toBe(run.id);
  });
});

describe("anthropic-client stub", () => {
  it("creates sessions and retrieves them", async () => {
    const client = createAnthropicClientStub();
    const session = await client.createSession({
      agentId: "agent_1",
      agentVersion: "1",
      environmentId: "env_1",
      title: "Test",
    });

    expect(session.id).toMatch(/^sess_stub_/);

    const retrieved = await client.retrieveSession(session.id);
    expect(retrieved.status).toBe("running");
  });

  it("streams canned events", async () => {
    const client = createAnthropicClientStub([
      { id: "sess_1", events: [{ type: "agent.message", text: "hello" }], status: "running" },
    ]);

    const stream = await client.streamSession("sess_1");
    const events: unknown[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
  });

  it("interrupt marks session as terminated", async () => {
    const client = createAnthropicClientStub();
    const session = await client.createSession({
      agentId: "a",
      agentVersion: "1",
      environmentId: "e",
      title: "T",
    });

    await client.interruptSession(session.id);
    const retrieved = await client.retrieveSession(session.id);
    expect(retrieved.status).toBe("terminated");
  });
});

describe("broadcaster stub", () => {
  it("records emitted events", () => {
    const broadcaster = createBroadcasterStub();
    broadcaster.emit("card_1", { type: "agent_message", text: "hello" });

    expect(broadcaster.recorded).toHaveLength(1);
    expect(broadcaster.recorded[0].cardId).toBe("card_1");
  });

  it("delivers events to subscribers", () => {
    const broadcaster = createBroadcasterStub();
    const received: unknown[] = [];
    broadcaster.subscribe("card_1", (e) => received.push(e));

    broadcaster.emit("card_1", { type: "agent_message", text: "hi" });
    broadcaster.emit("card_2", { type: "agent_message", text: "ignored" });

    expect(received).toHaveLength(1);
  });

  it("unsubscribe stops delivery", () => {
    const broadcaster = createBroadcasterStub();
    const received: unknown[] = [];
    const unsub = broadcaster.subscribe("card_1", (e) => received.push(e));

    broadcaster.emit("card_1", { type: "agent_message", text: "first" });
    unsub();
    broadcaster.emit("card_1", { type: "agent_message", text: "second" });

    expect(received).toHaveLength(1);
  });
});

describe("orchestrator stub", () => {
  it("records notifyCardMoved calls", async () => {
    const orch = createOrchestratorStub();
    await orch.notifyCardMoved("card_1", "col_done");

    expect(orch.notifications).toHaveLength(1);
    expect(orch.notifications[0].cardId).toBe("card_1");
    expect(orch.notifications[0].newColumnId).toBe("col_done");
  });
});
