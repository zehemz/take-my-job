import type { IOrchestrator } from "../interfaces.js";

export class StubOrchestrator implements IOrchestrator {
  calls: Array<{ cardId: string; newColumnId: string }> = [];

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
}
