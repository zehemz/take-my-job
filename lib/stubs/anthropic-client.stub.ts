import type { IAnthropicClient, AgentEvent, SessionInfo } from "../interfaces.js";

export class StubAnthropicClient implements IAnthropicClient {
  queue: AgentEvent[][] = [];
  createdSessions: Array<{ config: Parameters<IAnthropicClient["createSession"]>[0]; result: { id: string } }> = [];
  sentMessages: Array<{ sessionId: string; message: { type: string; [key: string]: unknown } }> = [];
  interruptedSessions: string[] = [];

  private sessionCounter = 0;
  private defaultSessionInfo: Partial<SessionInfo> = {};

  configureDefaultSession(info: Partial<SessionInfo>): void {
    this.defaultSessionInfo = info;
  }

  async createSession(config: Parameters<IAnthropicClient["createSession"]>[0]): Promise<{ id: string }> {
    const id = `session-${++this.sessionCounter}`;
    this.createdSessions.push({ config, result: { id } });
    return { id };
  }

  async *streamSession(_sessionId: string): AsyncIterable<AgentEvent> {
    const events = this.queue.shift() ?? [];
    for (const event of events) {
      yield event;
    }
  }

  async sendMessage(sessionId: string, message: { type: string; [key: string]: unknown }): Promise<void> {
    this.sentMessages.push({ sessionId, message });
  }

  async retrieveSession(sessionId: string): Promise<SessionInfo> {
    return {
      id: sessionId,
      status: "terminated",
      outcome: "success",
      ...this.defaultSessionInfo,
    };
  }

  async interruptSession(sessionId: string): Promise<void> {
    this.interruptedSessions.push(sessionId);
  }
}
