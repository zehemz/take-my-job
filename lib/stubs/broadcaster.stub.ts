import type { IBroadcaster } from "../interfaces";
import type { BroadcastEvent } from "../types";

export interface RecordedEvent {
  cardId: string;
  event: BroadcastEvent;
  timestamp: Date;
}

export function createBroadcasterStub(): IBroadcaster & { recorded: RecordedEvent[] } {
  const recorded: RecordedEvent[] = [];
  const subscribers = new Map<string, Set<(event: BroadcastEvent) => void>>();

  return {
    recorded,

    emit(cardId, event) {
      recorded.push({ cardId, event, timestamp: new Date() });
      const handlers = subscribers.get(cardId);
      if (handlers) {
        for (const handler of handlers) {
          handler(event);
        }
      }
    },

    subscribe(cardId, handler) {
      if (!subscribers.has(cardId)) {
        subscribers.set(cardId, new Set());
      }
      subscribers.get(cardId)!.add(handler);
      return () => {
        subscribers.get(cardId)?.delete(handler);
        if (subscribers.get(cardId)?.size === 0) {
          subscribers.delete(cardId);
        }
      };
    },
  };
}
