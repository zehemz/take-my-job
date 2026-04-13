import { describe, it, expect } from "vitest";
import { AgentRunStatus } from "../lib/types.js";

describe("AgentRunStatus enum", () => {
  it("has all expected statuses", () => {
    expect(AgentRunStatus.pending).toBe("pending");
    expect(AgentRunStatus.running).toBe("running");
    expect(AgentRunStatus.idle).toBe("idle");
    expect(AgentRunStatus.blocked).toBe("blocked");
    expect(AgentRunStatus.completed).toBe("completed");
    expect(AgentRunStatus.failed).toBe("failed");
    expect(AgentRunStatus.cancelled).toBe("cancelled");
  });

  it("has exactly 7 values", () => {
    const values = Object.values(AgentRunStatus);
    expect(values).toHaveLength(7);
  });
});
