import type { Card, Column, AgentRun, BroadcastEvent, UpdateCardInput } from "../types.js";
import type { IDbQueries, IBroadcaster, IAnthropicClient, AgentEvent } from "../interfaces.js";
import { handleUpdateCard } from "./tools.js";

function emitAndPersist(
  event: BroadcastEvent,
  cardId: string,
  runId: string,
  db: IDbQueries,
  broadcaster: IBroadcaster,
): Promise<void> {
  broadcaster.emit(cardId, event);
  return db.insertRunEvent(cardId, runId, event);
}

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
  event: AgentEvent,
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
      const text = event.content;
      if (text) {
        await db.appendAgentRunOutput(run.id, text);
      }
      await emitAndPersist({ type: "agent_message", text }, card.id, run.id, db, broadcaster);
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.thinking": {
      await emitAndPersist(
        { type: "agent_thinking", thinking: event.content },
        card.id, run.id, db, broadcaster,
      );
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.tool_use": {
      await emitAndPersist(
        { type: "tool_use", tool_name: event.toolName, input: event.input },
        card.id, run.id, db, broadcaster,
      );
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "agent.custom_tool_use": {
      if (event.toolName === "update_card") {
        const toolInput = event.input as UpdateCardInput;

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
          tool_use_id: event.toolUseId,
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
      const stopType = event.stopReason.type;

      if (stopType === "end_turn") {
        turnCount.value += 1;
        return { exitLoop: true, outcome: "completed" };
      }

      if (stopType === "retries_exhausted") {
        return { exitLoop: true, outcome: "failed" };
      }

      // "requires_action" — keep loop alive, waiting for tool result
      return { exitLoop: false };
    }

    // -----------------------------------------------------------------------
    case "session.status_terminated": {
      return { exitLoop: true, outcome: "terminated" };
    }

    // -----------------------------------------------------------------------
    case "session.error": {
      return { exitLoop: true, outcome: "failed", error: event.error };
    }

    // -----------------------------------------------------------------------
    case "span.model_request_end": {
      tokenUsage.inputTokens += event.usage.inputTokens;
      tokenUsage.outputTokens += event.usage.outputTokens;
      return { exitLoop: false };
    }
  }
}
