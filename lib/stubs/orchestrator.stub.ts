import type { IOrchestrator } from "../interfaces";

export interface RecordedNotification {
  cardId: string;
  newColumnId: string;
  timestamp: Date;
}

export function createOrchestratorStub(): IOrchestrator & { notifications: RecordedNotification[] } {
  const notifications: RecordedNotification[] = [];

  return {
    notifications,

    async start() {
      // No-op in stub
    },

    stop() {
      // No-op in stub
    },

    async notifyCardMoved(cardId, newColumnId) {
      notifications.push({ cardId, newColumnId, timestamp: new Date() });
    },
  };
}
