import type { Card, Column, AgentRun } from "../types";
import type { IDbQueries, IBroadcaster, IAnthropicClient, AgentSessionEvent } from "../interfaces";
import { handleUpdateCard, type UpdateCardInput } from "./tools";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface EventHandlerContext {
  card: Card & { column: Column };
  run: AgentRun;
  boardColumns: Column[];
  db: IDbQueries;
  broadcaster: IBroadcaster;
  anthropicClient: IAnthropicClient;
  sessionId: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
  turnCount: { value: number };
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface HandleEventResult {
  exitLoop: boolean;
  outcome?: "completed" | "failed" | "terminated";
  error?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleEvent(
  event: AgentSessionEvent,
  ctx: EventHandlerContext
): Promise<HandleEventResult> {
  const {
    card,
    run,
    boardColumns,
    db,
    broadcaster,
    anthropicClient,
    sessionId,
    tokenUsage,
    turnCount,
  } = ctx;

  switch (event.type) {
    // -----------------------------------------------------------------------
    case "agent.message": {
      const text = (event.text as string) ?? "";
      if (text) {
        await db.appendAgentRunOutput(run.id, text);
      }
      broadcaster.emit(card.id, {
        type: "agent_message",
        cardId: card.id,
        text,
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.thinking": {
      broadcaster.emit(card.id, {
        type: "agent_thinking",
        cardId: card.id,
        thinking: event.thinking,
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.tool_use": {
      broadcaster.emit(card.id, {
        type: "tool_use",
        cardId: card.id,
        tool_name: event.tool_name,
        input: event.input,
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.custom_tool_use": {
      if (event.tool_name === "update_card") {
        const toolUseId = event.tool_use_id as string | undefined;
        const toolInput = event.input as UpdateCardInput;

        const result = await handleUpdateCard(toolInput, {
          card,
          run,
          boardColumns,
          db,
          broadcaster,
          sessionId,
        });

        // Send tool result back to the session
        await anthropicClient.sendMessage(sessionId, {
          type: "user.custom_tool_result",
          tool_use_id: toolUseId,
          content: JSON.stringify(result),
        });

        if (result.shouldExitLoop) {
          return { exitLoop: true };
        }
      }
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "session.status_idle": {
      const stopReason = event.stop_reason as { type: string } | undefined;
      const stopType = stopReason?.type;

      if (stopType === "end_turn") {
        turnCount.value += 1;
        return { exitLoop: true, outcome: "completed" };
      }

      if (stopType === "retries_exhausted") {
        return { exitLoop: true, outcome: "failed" };
      }

      if (stopType === "requires_action") {
        // Waiting for tool result — keep loop alive
        return { exitLoop: false };
      }

      // Unknown idle stop reason — keep looping
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "session.status_terminated": {
      return { exitLoop: true, outcome: "terminated" };
    }

    // -----------------------------------------------------------------------
    case "session.error": {
      const errorMsg = (event.error as string) ?? "Unknown session error";
      return { exitLoop: true, outcome: "failed", error: errorMsg };
    }

    // -----------------------------------------------------------------------
    case "span.model_request_end": {
      const usage = event.usage as
        | { input_tokens?: number; output_tokens?: number }
        | undefined;
      if (usage) {
        tokenUsage.inputTokens += usage.input_tokens ?? 0;
        tokenUsage.outputTokens += usage.output_tokens ?? 0;
      }
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    default: {
      // Unhandled event — safe to ignore
      return { exitLoop: false };
    }
  }
}
