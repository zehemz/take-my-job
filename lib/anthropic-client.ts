import Anthropic from "@anthropic-ai/sdk";
import type { IAnthropicClient } from "./interfaces";

const client = new Anthropic();

// The managed agents API (sessions, agents, environments) is available at runtime
// but not yet typed in SDK 0.52.x. We access it via `any` until the SDK ships types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const beta = client.beta as any;

export const anthropicClient: IAnthropicClient = {
  async createSession(config) {
    const session = await beta.sessions.create({
      agent: {
        type: "agent",
        id: config.agentId,
        version: config.agentVersion,
      },
      environment_id: config.environmentId,
      title: config.title,
      resources: config.resources?.map((r) => ({
        type: "github_repository",
        url: r.url,
        authorization_token: r.authorization_token,
        mount_path: r.mount_path,
        checkout: r.checkout,
      })),
    });
    return { id: session.id };
  },

  async streamSession(sessionId: string) {
    const stream = await beta.sessions.events.stream(sessionId);
    return stream as AsyncIterable<unknown>;
  },

  async sendMessage(sessionId: string, message) {
    if (message.type === "user.interrupt") {
      await beta.sessions.events.send(sessionId, {
        events: [{ type: "user.interrupt" }],
      });
      return;
    }

    if (message.type === "user.message") {
      await beta.sessions.events.send(sessionId, {
        events: [{
          type: "user.message",
          content: message.content,
        }],
      });
      return;
    }

    if (message.type === "user.custom_tool_result") {
      await beta.sessions.events.send(sessionId, {
        events: [{
          type: "user.custom_tool_result",
          tool_use_id: message.tool_use_id,
          content: message.content,
        }],
      });
      return;
    }
  },

  async retrieveSession(sessionId: string) {
    const session = await beta.sessions.retrieve(sessionId);
    return {
      id: session.id,
      status: session.status,
      stop_reason: session.stop_reason ?? null,
    };
  },

  async interruptSession(sessionId: string) {
    await beta.sessions.events.send(sessionId, {
      events: [{ type: "user.interrupt" }],
    });
  },
};
