import type { Card, Column, AgentRun } from "./types";
import type { IDbQueries, IAnthropicClient, IBroadcaster } from "./interfaces";
import { renderTurnPrompt } from "./prompt-renderer";
import { handleEvent } from "./agent-runner/event-handler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TURNS = parseInt(process.env.MAX_TURNS ?? "10", 10);

const CONTINUATION_MESSAGE =
  "Please continue working on the task. Remember to call update_card(completed) when done.";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AgentRunnerDeps {
  db: IDbQueries;
  anthropicClient: IAnthropicClient;
  broadcaster: IBroadcaster;
}

/**
 * Run an agent session for a given card + AgentRun record.
 *
 * The function is fully self-contained: it creates the Anthropic session,
 * streams events, dispatches tool calls, and handles retries / turn limits.
 * An optional AbortSignal can be used to cancel mid-run.
 */
export async function run(
  card: Card & { column: Column },
  agentRun: AgentRun,
  deps: AgentRunnerDeps,
  signal?: AbortSignal
): Promise<void> {
  const { db, anthropicClient, broadcaster } = deps;

  try {
    // 1. Load AgentConfig
    const agentConfig = await db.getAgentConfig(agentRun.role);
    if (!agentConfig) {
      throw new Error(`No AgentConfig found for role: ${agentRun.role}`);
    }

    // 2. Load board columns
    const boardColumns = await db.getBoardColumns(card.boardId);

    // 3. Create Anthropic session
    const resources: Array<{
      type: "github_repository";
      url: string;
      authorization_token: string;
      mount_path: string;
      checkout: { type: "branch"; name: string };
    }> = card.githubRepoUrl
      ? [
          {
            type: "github_repository",
            url: card.githubRepoUrl,
            authorization_token: process.env.GITHUB_TOKEN ?? "",
            mount_path: "/workspace/repo",
            checkout: { type: "branch", name: card.githubBranch ?? "main" },
          },
        ]
      : [];

    const session = await anthropicClient.createSession({
      agentId: agentConfig.anthropicAgentId,
      agentVersion: agentConfig.anthropicAgentVersion,
      environmentId: agentConfig.anthropicEnvironmentId,
      title: `${agentRun.role} — ${card.title} (attempt ${agentRun.attempt})`,
      resources,
    });

    const sessionId = session.id;

    // 4. Mark AgentRun as running with sessionId
    const currentRun = await db.updateAgentRunStatus(agentRun.id, "running", {
      sessionId,
    });

    // 5. Render initial prompt
    const prompt = renderTurnPrompt({
      card,
      run: currentRun,
      currentColumn: card.column,
      boardColumns,
      roleDisplayName: agentRun.role,
    });

    // 6. Open stream and send first message concurrently
    const [stream] = await Promise.all([
      Promise.resolve(anthropicClient.streamSession(sessionId)),
      anthropicClient.sendMessage(sessionId, {
        type: "user.message",
        content: prompt,
      }),
    ]);

    // Shared mutable state threaded through handleEvent
    const tokenUsage = { inputTokens: 0, outputTokens: 0 };
    const turnCount = { value: 0 };

    // Track whether we successfully completed
    let outcome: "completed" | "failed" | "terminated" | undefined;

    // 7. Event loop
    outerLoop: for await (const event of stream) {
      // Abort check
      if (signal?.aborted) {
        await anthropicClient.interruptSession(sessionId);
        await db.updateAgentRunStatus(currentRun.id, "cancelled");
        return;
      }

      const result = await handleEvent(event, {
        card,
        run: currentRun,
        boardColumns,
        db,
        broadcaster,
        anthropicClient,
        sessionId,
        tokenUsage,
        turnCount,
      });

      if (result.exitLoop) {
        outcome = result.outcome;

        // If the loop exited due to end_turn (idle) and we haven't completed
        // via update_card, check whether we should continue or give up.
        if (
          outcome === "completed" &&
          currentRun.status !== "completed" &&
          currentRun.status !== "blocked"
        ) {
          // The session went idle without the agent calling update_card(completed)
          if (turnCount.value < MAX_TURNS) {
            // Send a nudge and keep iterating the same stream
            await anthropicClient.sendMessage(sessionId, {
              type: "user.message",
              content: CONTINUATION_MESSAGE,
            });
            // Do NOT break — continue iterating stream events
            continue outerLoop;
          } else {
            // Max turns reached without completion
            await db.updateAgentRunStatus(currentRun.id, "failed", {
              error: `Max turns (${MAX_TURNS}) reached without completing the task.`,
              retryAfterMs: null,
            });
            return;
          }
        }

        break outerLoop;
      }
    }

    // Post-loop: if the run did not reach a terminal DB state, mark failed
    if (outcome === "failed") {
      await db.updateAgentRunStatus(currentRun.id, "failed", {
        error: result_error(outcome),
      });
    } else if (outcome === "terminated") {
      await db.updateAgentRunStatus(currentRun.id, "cancelled");
    }
    // "completed" and "blocked" statuses are already set by handleUpdateCard
  } catch (err: unknown) {
    // 9. Generic error handling
    const message = err instanceof Error ? err.message : String(err);
    await db.updateAgentRunStatus(agentRun.id, "failed", {
      error: message,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function result_error(outcome: string | undefined): string {
  switch (outcome) {
    case "failed":
      return "Agent session failed (retries exhausted or session error).";
    case "terminated":
      return "Agent session was terminated unexpectedly.";
    default:
      return "Agent run ended without completion.";
  }
}
