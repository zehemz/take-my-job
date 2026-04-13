import type { BroadcastEvent } from "./types";
import type { IBroadcaster } from "./interfaces";

/**
 * In-process pub-sub broadcaster keyed by cardId.
 *
 * - emit(cardId, event)   — fans out to every handler subscribed to that cardId.
 * - subscribe(cardId, fn) — registers a handler and returns an unsubscribe fn.
 * - When the last subscriber for a cardId unsubscribes, the entry is deleted to
 *   prevent memory leaks.
 */
export class Broadcaster implements IBroadcaster {
  private readonly handlers = new Map<string, Set<(event: BroadcastEvent) => void>>();

  emit(cardId: string, event: BroadcastEvent): void {
    const subscribers = this.handlers.get(cardId);
    if (!subscribers) return;

    // Snapshot the set before iterating so that a handler that unsubscribes
    // during its own invocation does not affect the current fan-out.
    for (const handler of [...subscribers]) {
      handler(event);
    }
  }

  subscribe(cardId: string, handler: (event: BroadcastEvent) => void): () => void {
    let subscribers = this.handlers.get(cardId);
    if (!subscribers) {
      subscribers = new Set();
      this.handlers.set(cardId, subscribers);
    }

    subscribers.add(handler);

    return () => {
      const set = this.handlers.get(cardId);
      if (!set) return;

      set.delete(handler);

      // Clean up the cardId entry when there are no more listeners.
      if (set.size === 0) {
        this.handlers.delete(cardId);
      }
    };
  }
}
