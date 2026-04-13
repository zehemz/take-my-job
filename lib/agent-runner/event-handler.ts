import type { Card, Column, AgentRun, UpdateCardInput } from "../types";
import type { IDbQueries, IBroadcaster, IAnthropicClient } from "../interfaces";
import { handleUpdateCard } from "./tools";

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
  event: unknown,
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

  const e = event as Record<string, unknown>;

  switch (e.type) {
    // -----------------------------------------------------------------------
    case "agent.message": {
      const text = (e.text as string) ?? "";
      if (text) {
        await db.appendAgentRunOutput(run.id, text);
      }
      broadcaster.emit(card.id, { type: "agent_message", text });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.thinking": {
      broadcaster.emit(card.id, {
        type: "agent_thinking",
        thinking: e.thinking as string,
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.tool_use": {
      broadcaster.emit(card.id, {
        type: "tool_use",
        tool_name: e.tool_name as string,
        input: e.input,
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.custom_tool_use": {
      if (e.tool_name === "update_card") {
        const toolUseId = e.tool_use_id as string | undefined;
        const toolInput = e.input as UpdateCardInput;

        const result = await handleUpdateCard(toolInput, {
          card,
          run,
          boardColumns,
          db,
          broadcaster,
          sessionId,
        });

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
      const stopReason = e.stop_reason as { type: string } | undefined;
      const stopType = stopReason?.type;

      if (stopType === "end_turn") {
        turnCount.value += 1;
        return { exitLoop: true, outcome: "completed" };
      }

      if (stopType === "retries_exhausted") {
        return { exitLoop: true, outcome: "failed" };
      }

      // "requires_action" or unknown — keep loop alive
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "session.status_terminated": {
      return { exitLoop: true, outcome: "terminated" };
    }

    // -----------------------------------------------------------------------
    case "session.error": {
      const errorMsg = (e.error as string) ?? "Unknown session error";
      return { exitLoop: true, outcome: "failed", error: errorMsg };
    }

    // -----------------------------------------------------------------------
    case "span.model_request_end": {
      const usage = e.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (usage) {
        tokenUsage.inputTokens += usage.input_tokens ?? 0;
        tokenUsage.outputTokens += usage.output_tokens ?? 0;
      }
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    default:
      return { exitLoop: false };
  }
}
