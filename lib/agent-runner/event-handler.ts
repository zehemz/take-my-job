import type { Card, Column, AgentRun, UpdateCardInput } from "../types";
import type { IDbQueries, IAnthropicClient } from "../interfaces";
import { handleUpdateCard } from "./tools";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface EventHandlerContext {
  card: Card & { column: Column };
  run: AgentRun;
  boardColumns: Column[];
  db: IDbQueries;
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
    anthropicClient,
    sessionId,
    tokenUsage,
    turnCount,
  } = ctx;

  const e = event as Record<string, unknown>;

  switch (e.type) {
    // -----------------------------------------------------------------------
    case "agent.message": {
      // SDK: content is Array<{type:"text", text:string}>
      const contentBlocks = e.content as Array<{ type: string; text?: string }> | undefined;
      const text = contentBlocks?.map((b) => b.text ?? "").join("") ?? "";
      if (text) {
        await db.appendAgentRunOutput(run.id, text);
      }
      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "agent_message",
        payload: { text },
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.thinking": {
      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "agent_thinking",
        payload: { thinking: "" },
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.tool_use": {
      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "tool_use",
        payload: { tool_name: e.name as string, input: e.input },
      });
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.custom_tool_use": {
      // SDK: tool name is `name`, event ID is `id`
      if (e.name === "update_card") {
        const toolUseId = e.id as string;
        const toolInput = e.input as UpdateCardInput;

        const result = await handleUpdateCard(toolInput, {
          card,
          run,
          boardColumns,
          db,
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
      // SDK: error is an object with a `message` field
      const errorObj = e.error as { message?: string } | undefined;
      const errorMsg = errorObj?.message ?? "Unknown session error";
      return { exitLoop: true, outcome: "failed", error: errorMsg };
    }

    // -----------------------------------------------------------------------
    case "span.model_request_end": {
      // SDK: field is `model_usage`, not `usage`
      const usage = e.model_usage as { input_tokens?: number; output_tokens?: number } | undefined;
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
