import type { Card, Column, AgentRun, UpdateCardInput } from "../types";
import { AgentRunStatus } from "../types";
import type { IDbQueries } from "../interfaces";
import { renderCliCommand } from "../config";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface UpdateCardContext {
  card: Card & { column: Column };
  run: AgentRun;
  boardColumns: Column[];
  db: IDbQueries;
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
  const { card, run, boardColumns, db, sessionId } = ctx;

  switch (input.status) {
    // -----------------------------------------------------------------------
    case "in_progress": {
      await db.appendAgentRunOutput(run.id, input.summary);

      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "card_update",
        payload: { status: "in_progress", summary: input.summary },
      });

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

      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "card_update",
        payload: {
          status: "completed",
          summary: input.summary,
          next_column: targetColumn.name,
          criteria_results: input.criteria_results ?? null,
        },
      });

      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "status_change",
        payload: { status: AgentRunStatus.completed },
      });

      return { success: true };
    }

    // -----------------------------------------------------------------------
    case "blocked": {
      const blockedReason = input.blocked_reason ?? "No reason provided.";

      await db.updateAgentRunStatus(run.id, AgentRunStatus.blocked, {
        blockedReason,
      });

      // Move card to blocked column immediately so board polling reflects the state
      // even if the SSE connection is lost (e.g. Vercel 60s timeout).
      try {
        await db.moveCardToColumnType(card.id, card.boardId, 'blocked');
      } catch (err) {
        console.error('[update_card] failed to move card to blocked column:', err);
      }

      await db.insertOrchestratorEvent({
        boardId: card.boardId,
        cardId: card.id,
        runId: run.id,
        type: "card_blocked",
        payload: {
          reason: blockedReason,
          session_id: sessionId,
          cli_command: renderCliCommand(sessionId),
        },
      });

      return { success: true, shouldExitLoop: true };
    }

    // -----------------------------------------------------------------------
    default: {
      const _exhaustive: never = input.status;
      return { success: false, reason: `Unknown status: ${String(_exhaustive)}` };
    }
  }
}
