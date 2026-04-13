import type { Card, Column, AgentRun } from "./types.js";
import { AgentRunStatus } from "./types.js";
import type { IDbQueries, IAnthropicClient, IBroadcaster } from "./interfaces.js";
import { config } from "./config.js";
import { renderTurnPrompt } from "./prompt-renderer.js";
import { handleEvent } from "./agent-runner/event-handler.js";

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
      authorization_token?: string;
      mount_path: string;
      checkout: { type: "branch"; name: string };
    }> = card.githubRepoUrl
      ? [
          {
            type: "github_repository",
            url: card.githubRepoUrl,
            authorization_token: config.GITHUB_TOKEN,
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
    const currentRun = await db.updateAgentRunStatus(agentRun.id, AgentRunStatus.running, {
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

    // 6. Stream-first ordering (spec §6.3): get the iterable before sending the message.
    // streamSession() is now sync — calling it registers the stream before the message fires.
    const stream = anthropicClient.streamSession(sessionId);
    await anthropicClient.sendMessage(sessionId, {
      type: "user.message",
      content: prompt,
    });

    // Shared mutable state threaded through handleEvent
    const tokenUsage = { inputTokens: 0, outputTokens: 0 };
    const turnCount = { value: 0 };
    let finalOutcome: "completed" | "failed" | "terminated" | undefined;
    let finalError: string | undefined;

    // 7. Event loop
    outerLoop: for await (const event of stream) {
      // Abort check
      if (signal?.aborted) {
        await anthropicClient.interruptSession(sessionId);
        await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.cancelled);
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
        finalOutcome = result.outcome;
        finalError = result.error;

        // session.status_idle with end_turn: agent finished a turn but may not have
        // called update_card(completed) yet — check turn limit and nudge if needed.
        if (
          finalOutcome === "completed" &&
          currentRun.status !== AgentRunStatus.completed &&
          currentRun.status !== AgentRunStatus.blocked
        ) {
          if (turnCount.value < config.MAX_TURNS) {
            await anthropicClient.sendMessage(sessionId, {
              type: "user.message",
              content:
                "Please continue working on the task. Remember to call update_card(completed) when done.",
            });
            finalOutcome = undefined;
            continue outerLoop;
          } else {
            await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.failed, {
              error: `Max turns (${config.MAX_TURNS}) reached without completing the task.`,
            });
            return;
          }
        }

        break outerLoop;
      }
    }

    // 8. Post-loop terminal state handling
    if (finalOutcome === "failed") {
      await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.failed, {
        error: finalError ?? "Agent session failed.",
      });
    } else if (finalOutcome === "terminated") {
      await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.cancelled);
    }
    // "completed" and "blocked" are already written by handleUpdateCard
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await db.updateAgentRunStatus(agentRun.id, AgentRunStatus.failed, {
      error: message,
    });
  } finally {
    broadcaster.emit(card.id, { type: "done" });
    await db.insertRunEvent(card.id, agentRun.id, { type: "done" }).catch(() => {});
  }
}
