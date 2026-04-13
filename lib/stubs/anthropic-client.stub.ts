import type { IAnthropicClient } from "../interfaces";

export interface CannedSession {
  id: string;
  events: unknown[];
  status: string;
  stop_reason?: { type: string } | null;
}

export function createAnthropicClientStub(sessions?: CannedSession[]): IAnthropicClient {
  const sessionMap = new Map<string, CannedSession>(
    (sessions ?? []).map((s) => [s.id, s]),
  );
  let sessionIdCounter = 1;

  return {
    async createSession(config) {
      const id = `sess_stub_${sessionIdCounter++}`;
      sessionMap.set(id, {
        id,
        events: [],
        status: "running",
      });
      return { id };
    },

    async streamSession(sessionId) {
      const session = sessionMap.get(sessionId);
      const events = session?.events ?? [];
      async function* generate() {
        for (const event of events) {
          yield event;
        }
      }
      return generate();
    },

    async sendMessage(_sessionId, _message) {
      // No-op in stub
    },

    async retrieveSession(sessionId) {
      const session = sessionMap.get(sessionId);
      if (!session) {
        return { id: sessionId, status: "terminated", stop_reason: { type: "error" } };
      }
      return {
        id: session.id,
        status: session.status,
        stop_reason: session.stop_reason,
      };
    },

    async interruptSession(sessionId) {
      const session = sessionMap.get(sessionId);
      if (session) {
        session.status = "terminated";
        session.stop_reason = { type: "interrupted" };
      }
    },
  };
}
