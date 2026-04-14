import { describe, it, expect } from "vitest";
import { StubDbQueries } from "../lib/stubs/db-queries.stub.js";
import { StubAnthropicClient } from "../lib/stubs/anthropic-client.stub.js";
import { StubOrchestrator } from "../lib/stubs/orchestrator.stub.js";
import { AgentRunStatus } from "../lib/types.js";
import type { Card, Column } from "../lib/types.js";

const makeColumn = (overrides: Partial<Column> = {}): Column => ({
  id: "col_1",
  boardId: "board_1",
  name: "In Progress",
  position: 1,
  isActiveState: true,
  isTerminalState: false,
  columnType: 'active',
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
  environmentId: 'env_test',
  requiresApproval: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("db-queries stub", () => {
  it("returns eligible cards in active columns excluding claimed", async () => {
    const db = new StubDbQueries();
    db.columns.push(makeColumn());
    db.cards.push(makeCard({ id: "card_1" }), makeCard({ id: "card_2" }));

    const eligible = await db.getEligibleCards(5, ["card_1"]);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe("card_2");
  });

  it("creates and retrieves agent runs", async () => {
    const db = new StubDbQueries();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);

    expect(run.status).toBe(AgentRunStatus.pending);
    expect(run.attempt).toBe(1);

    const updated = await db.updateAgentRunStatus(run.id, AgentRunStatus.running);
    expect(updated.status).toBe(AgentRunStatus.running);
  });

  it("appends output without overwriting", async () => {
    const db = new StubDbQueries();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);

    await db.appendAgentRunOutput(run.id, "Hello ");
    await db.appendAgentRunOutput(run.id, "World");

    await db.updateAgentRunStatus(run.id, AgentRunStatus.running);
    const runningRuns = await db.getRunningRuns();
    expect(runningRuns).toHaveLength(1);
    expect(runningRuns[0].output).toBe("Hello World");
  });

  it("moves card to new column", async () => {
    const db = new StubDbQueries();
    db.columns.push(
      makeColumn({ id: "col_1", name: "In Progress" }),
      makeColumn({ id: "col_2", name: "Done", isTerminalState: true, isActiveState: false }),
    );
    db.cards.push(makeCard({ columnId: "col_1" }));

    const moved = await db.moveCard("card_1", "col_2");
    expect(moved.columnId).toBe("col_2");
  });

  it("finds column by name", async () => {
    const db = new StubDbQueries();
    db.columns.push(makeColumn({ name: "Review" }));

    const found = await db.getColumnByName("board_1", "Review");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Review");

    const notFound = await db.getColumnByName("board_1", "Nonexistent");
    expect(notFound).toBeNull();
  });

  it("returns retry-eligible runs", async () => {
    const db = new StubDbQueries();
    const run = await db.createAgentRun("card_1", "col_1", "qa", 1);
    await db.updateAgentRunStatus(run.id, AgentRunStatus.failed, {
      retryAfterMs: Date.now() - 1000,
    });

    const retryable = await db.getRetryEligibleRuns();
    expect(retryable).toHaveLength(1);
    expect(retryable[0].id).toBe(run.id);
  });
});

describe("anthropic-client stub", () => {
  it("creates sessions and retrieves them", async () => {
    const client = new StubAnthropicClient();
    const session = await client.createSession({
      agentId: "agent_1",
      agentVersion: "1",
      environmentId: "env_1",
      title: "Test",
    });

    expect(session.id).toMatch(/^session-/);
  });

  it("streams canned events", async () => {
    const client = new StubAnthropicClient();
    client.queue.push([{ type: "agent.message", content: [{ type: "text", text: "hello" }] }]);

    const events: unknown[] = [];
    for await (const event of client.streamSession("sess_1")) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
  });

  it("records interrupted sessions", async () => {
    const client = new StubAnthropicClient();
    const session = await client.createSession({
      agentId: "a",
      agentVersion: "1",
      environmentId: "e",
      title: "T",
    });

    await client.interruptSession(session.id);
    expect(client.interruptedSessions).toContain(session.id);
  });
});

describe("orchestrator stub", () => {
  it("records notifyCardMoved calls", async () => {
    const orch = new StubOrchestrator();
    await orch.notifyCardMoved("card_1", "col_done");

    expect(orch.calls).toHaveLength(1);
    expect(orch.calls[0].cardId).toBe("card_1");
    expect(orch.calls[0].newColumnId).toBe("col_done");
  });
});
