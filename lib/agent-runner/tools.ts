import type { Card, Column, AgentRun, BroadcastEvent, UpdateCardInput } from "../types.js";
import { AgentRunStatus } from "../types.js";
import type { IDbQueries, IBroadcaster } from "../interfaces.js";
import { renderCliCommand } from "../config.js";

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

export interface UpdateCardContext {
  card: Card & { column: Column };
  run: AgentRun;
  boardColumns: Column[];
  db: IDbQueries;
  broadcaster: IBroadcaster;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UpdateCardResult {
  success: boolean;
  reason?: string;
  shouldExitLoop?: boolean;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleUpdateCard(
  input: UpdateCardInput,
  ctx: UpdateCardContext
): Promise<UpdateCardResult> {
  const { card, run, boardColumns, db, broadcaster, sessionId } = ctx;

  switch (input.status) {
    // -----------------------------------------------------------------------
    case "in_progress": {
      await db.appendAgentRunOutput(run.id, input.summary);

      await emitAndPersist(
        { type: "card_update", status: "in_progress", summary: input.summary },
        card.id, run.id, db, broadcaster,
      );

      return { success: true };
    }

    // -----------------------------------------------------------------------
    case "completed": {
      // Determine target column
      let targetColumn: Column | undefined;

      if (input.next_column) {
        targetColumn = boardColumns.find((c) => c.name === input.next_column);
        if (!targetColumn) {
          const validNames = boardColumns.map((c) => c.name).join(", ");
          return {
            success: false,
            reason: `Unknown column: ${input.next_column}. Valid columns: ${validNames}`,
          };
        }
      } else {
        const sorted = [...boardColumns].sort((a, b) => a.position - b.position);
        targetColumn = sorted.find((c) => c.isTerminalState);
        if (!targetColumn) {
          return { success: false, reason: "No terminal column found on the board." };
        }
      }

      // Validate all criteria passed
      if (input.criteria_results && input.criteria_results.length > 0) {
        for (const cr of input.criteria_results) {
          if (!cr.passed) {
            return { success: false, reason: `Criterion failed: ${cr.criterion}` };
          }
        }
      }

      const criteriaJson = input.criteria_results
        ? JSON.stringify(input.criteria_results)
        : undefined;

      await db.updateAgentRunStatus(run.id, AgentRunStatus.completed, {
        output: input.summary,
        ...(criteriaJson ? { criteriaResults: criteriaJson } : {}),
      });

      await db.moveCard(card.id, targetColumn.id);

      // Notify the board-level stream that this card changed columns
      await db.insertBoardEvent(card.boardId, {
        type: "card_updated",
        cardId: card.id,
        columnId: targetColumn.id,
        columnName: targetColumn.name,
      });

      await emitAndPersist(
        {
          type: "card_update",
          status: "completed",
          summary: input.summary,
          next_column: targetColumn.name,
          criteria_results: input.criteria_results,
        },
        card.id, run.id, db, broadcaster,
      );

      await emitAndPersist(
        { type: "status_change", status: AgentRunStatus.completed },
        card.id, run.id, db, broadcaster,
      );

      return { success: true };
    }

    // -----------------------------------------------------------------------
    case "blocked": {
      const blockedReason = input.blocked_reason ?? "No reason provided.";

      await db.updateAgentRunStatus(run.id, AgentRunStatus.blocked, {
        blockedReason,
      });

      await emitAndPersist(
        {
          type: "card_blocked",
          reason: blockedReason,
          session_id: sessionId,
          cli_command: renderCliCommand(sessionId),
        },
        card.id, run.id, db, broadcaster,
      );

      return { success: true, shouldExitLoop: true };
    }

    // -----------------------------------------------------------------------
    default: {
      const _exhaustive: never = input.status;
      return { success: false, reason: `Unknown status: ${String(_exhaustive)}` };
    }
  }
}
