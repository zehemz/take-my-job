import type { Card, Column, AgentRun } from "./types";
import { AgentRunStatus } from "./types";
import type { IDbQueries, IAnthropicClient, AgentEvent } from "./interfaces";
import { config } from "./config";
import { renderTurnPrompt } from "./prompt-renderer";
import { handleEvent } from "./agent-runner/event-handler";
import { scheduleRetry } from "./orchestrator/retry";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AgentRunnerDeps {
  db: IDbQueries;
  anthropicClient: IAnthropicClient;
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
): Promise<void> {
  const { db, anthropicClient } = deps;

  try {
    // 1. Load AgentConfig
    const agentConfig = await db.getAgentConfig(agentRun.role);
    if (!agentConfig) {
      throw new Error(`No AgentConfig found for role: ${agentRun.role}`);
    }

    // 2. Load board columns + board metadata
    const [boardColumns, board] = await Promise.all([
      db.getBoardColumns(card.boardId),
      db.getBoard(card.boardId),
    ]);

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
      environmentId: agentConfig.anthropicEnvironmentId ?? board?.anthropicEnvironmentId,
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
      workspacePath: board?.workspacePath ?? null,
    });

    // 6. Open stream and send first message concurrently (stream-first per spec §6.3)
    const [stream] = await Promise.all([
      anthropicClient.streamSession(sessionId),
      anthropicClient.sendMessage(sessionId, {
        type: "user.message",
        content: prompt,
      }),
    ]);

    await runEventLoop(stream, card, currentRun, sessionId, boardColumns, deps);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await scheduleRetry(agentRun, deps.db, message);
  }
}

/**
 * Resume a blocked agent session after human input has been sent.
 *
 * Unlike run(), this does NOT create a new Anthropic session — it reattaches
 * to the existing session identified by agentRun.sessionId and resumes the
 * event loop. The caller is responsible for sending the human reply to the
 * session before calling this function.
 */
export async function resumeBlocked(
  card: Card & { column: Column },
  agentRun: AgentRun,
  deps: AgentRunnerDeps,
): Promise<void> {
  const sessionId = agentRun.sessionId!;
  try {
    const boardColumns = await deps.db.getBoardColumns(card.boardId);
    const stream = await deps.anthropicClient.streamSession(sessionId);
    await runEventLoop(stream, card, agentRun, sessionId, boardColumns, deps);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.db.updateAgentRunStatus(agentRun.id, AgentRunStatus.failed, {
      error: message,
    });
  }
}

// ---------------------------------------------------------------------------
// Shared event loop
// ---------------------------------------------------------------------------

async function runEventLoop(
  stream: AsyncIterable<AgentEvent>,
  card: Card & { column: Column },
  currentRun: AgentRun,
  sessionId: string,
  boardColumns: Column[],
  deps: AgentRunnerDeps,
): Promise<void> {
  const { db, anthropicClient } = deps;

  const tokenUsage = { inputTokens: 0, outputTokens: 0 };
  let finalOutcome: "completed" | "failed" | "terminated" | undefined;
  let finalError: string | undefined;

  outerLoop: for await (const event of stream) {
    const result = await handleEvent(event, {
      card,
      run: currentRun,
      boardColumns,
      db,
      anthropicClient,
      sessionId,
      tokenUsage,
    });

    if (result.exitLoop) {
      finalOutcome = result.outcome;
      finalError = result.error;

      // session.status_idle with end_turn: agent finished a turn without
      // calling update_card — check events to decide whether to nudge.
      if (finalOutcome === "completed") {
        // Did the agent already complete or block via update_card?
        const alreadyDone = await db.hasRunEvent(currentRun.id, 'status_change');
        if (alreadyDone) {
          break outerLoop;
        }

        // Record this turn ending, then count total turns from DB
        await db.insertOrchestratorEvent({
          boardId: card.boardId,
          cardId: card.id,
          runId: currentRun.id,
          type: 'turn_ended',
          payload: {},
        });

        const turns = await db.countRunEvents(currentRun.id, 'turn_ended');
        if (turns < config.MAX_TURNS) {
          await anthropicClient.sendMessage(sessionId, {
            type: "user.message",
            content:
              "Please continue working on the task. Remember to call update_card(completed) when done.",
          });
          await db.insertOrchestratorEvent({
            boardId: card.boardId,
            cardId: card.id,
            runId: currentRun.id,
            type: 'continue_sent',
            payload: {},
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

  if (finalOutcome === "failed") {
    await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.failed, {
      error: finalError ?? "Agent session failed.",
    });
  } else if (finalOutcome === "terminated") {
    await db.updateAgentRunStatus(currentRun.id, AgentRunStatus.cancelled);
  }
  // "completed" and "blocked" are already written by handleUpdateCard

  // Always interrupt the Anthropic session when the event loop exits,
  // otherwise it keeps running on the platform even after we stop reading.
  if (finalOutcome === "completed" || finalOutcome === "failed") {
    await anthropicClient.interruptSession(sessionId).catch(() => {});
  }
}
