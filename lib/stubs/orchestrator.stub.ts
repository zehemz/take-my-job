import type { IOrchestrator } from "../interfaces.js";
import type { AgentRun } from "../types.js";

export class StubOrchestrator implements IOrchestrator {
  calls: Array<{ cardId: string; newColumnId: string }> = [];
  unblockedCalls: Array<{ cardId: string; run: AgentRun }> = [];

  async start(): Promise<void> {
    // No-op in stub
  }

  stop(): void {
    // No-op in stub
  }

  async notifyCardMoved(cardId: string, newColumnId: string): Promise<void> {
    this.calls.push({ cardId, newColumnId });
  }

  unclaim(_cardId: string): void {
    // No-op in stub
  }

  async notifyCardUnblocked(cardId: string, run: AgentRun): Promise<void> {
    this.unblockedCalls.push({ cardId, run });
  }
}
