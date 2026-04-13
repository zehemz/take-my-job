import type { IBroadcaster } from "../interfaces.js";
import type { BroadcastEvent } from "../types.js";

export class StubBroadcaster implements IBroadcaster {
  emitted: Array<{ cardId: string; event: BroadcastEvent }> = [];
  private subscribers = new Map<string, Set<(event: BroadcastEvent) => void>>();

  emit(cardId: string, event: BroadcastEvent): void {
    this.emitted.push({ cardId, event });
    const handlers = this.subscribers.get(cardId);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  subscribe(cardId: string, handler: (event: BroadcastEvent) => void): () => void {
    if (!this.subscribers.has(cardId)) {
      this.subscribers.set(cardId, new Set());
    }
    const handlers = this.subscribers.get(cardId)!;
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }
}
