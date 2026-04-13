import type { Card, Column, AgentRun } from "../types";
import type { IDbQueries, IBroadcaster } from "../interfaces";

// ---------------------------------------------------------------------------
// Input / Context types
// ---------------------------------------------------------------------------

export interface UpdateCardInput {
  status: "in_progress" | "completed" | "blocked";
  summary: string;
  next_column?: string;
  criteria_results?: Array<{ criterion: string; passed: boolean; evidence: string }>;
  blocked_reason?: string;
}

export interface UpdateCardContext {
  card: Card & { column: Column };
  run: AgentRun;
  boardColumns: Column[];
  db: IDbQueries;
  broadcaster: IBroadcaster;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Result type
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

      broadcaster.emit(card.id, {
        type: "card_update",
        cardId: card.id,
        status: "in_progress",
        summary: input.summary,
      });

      return { success: true };
    }

    // -----------------------------------------------------------------------
    case "completed": {
      // Determine target column
      let targetColumn: Column | undefined;

      if (input.next_column) {
        targetColumn = boardColumns.find(
          (c) => c.name === input.next_column
        );
        if (!targetColumn) {
          const validNames = boardColumns.map((c) => c.name).join(", ");
          return {
            success: false,
            reason: `Unknown column: ${input.next_column}. Valid columns: ${validNames}`,
          };
        }
      } else {
        // Pick first terminal column by position
        const sorted = [...boardColumns].sort((a, b) => a.position - b.position);
        targetColumn = sorted.find((c) => c.isTerminalState);
        if (!targetColumn) {
          return {
            success: false,
            reason: "No terminal column found on the board.",
          };
        }
      }

      // Validate criteria results
      if (input.criteria_results && input.criteria_results.length > 0) {
        for (const cr of input.criteria_results) {
          if (!cr.passed) {
            return {
              success: false,
              reason: `Criterion failed: ${cr.criterion}`,
            };
          }
        }
      }

      // Persist summary and criteria
      const criteriaJson = input.criteria_results
        ? JSON.stringify(input.criteria_results)
        : undefined;

      await db.updateAgentRunStatus(run.id, "completed", {
        output: input.summary,
        ...(criteriaJson ? { criteriaResults: criteriaJson } : {}),
      });

      // Move card to target column
      await db.moveCard(card.id, targetColumn.id);

      // Broadcast events
      broadcaster.emit(card.id, {
        type: "card_update",
        cardId: card.id,
        status: "completed",
        summary: input.summary,
        nextColumn: targetColumn.name,
      });

      broadcaster.emit(card.id, {
        type: "status_change",
        cardId: card.id,
        status: "completed",
      });

      return { success: true };
    }

    // -----------------------------------------------------------------------
    case "blocked": {
      const blockedReason = input.blocked_reason ?? "No reason provided.";

      await db.updateAgentRunStatus(run.id, "blocked", {
        blockedReason,
      });

      // Build CLI command
      const template =
        process.env.CLI_ATTACH_COMMAND_TEMPLATE ?? "ant session attach {sessionId}";
      const cliCommand = template.replace("{sessionId}", sessionId);

      broadcaster.emit(card.id, {
        type: "card_blocked",
        cardId: card.id,
        reason: blockedReason,
        session_id: sessionId,
        cli_command: cliCommand,
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
