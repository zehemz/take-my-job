import type { Card, Column, AgentRun } from "./types";

export interface PromptRenderInput {
  card: Card;
  run: AgentRun;
  currentColumn: Column;
  boardColumns: Column[];
  roleDisplayName: string;
}

export function renderTurnPrompt(input: PromptRenderInput): string {
  const { card, run, currentColumn, boardColumns, roleDisplayName } = input;

  const lines: string[] = [];

  lines.push(
    `You are working on a Kanban task assigned to you as ${roleDisplayName}.`
  );
  lines.push("");
  lines.push("## Task");
  lines.push("");
  lines.push(`**Title:** ${card.title}`);

  if (card.description) {
    lines.push("");
    lines.push("**Description:**");
    lines.push(card.description);
  }

  if (card.githubRepoUrl) {
    const branch = card.githubBranch ?? "main";
    lines.push("");
    lines.push(
      `**Repository:** ${card.githubRepoUrl} (mounted at /workspace/repo, branch: ${branch})`
    );
  }

  if (card.acceptanceCriteria) {
    lines.push("");
    lines.push("## Acceptance Criteria");
    lines.push("");
    lines.push(
      "You MUST verify every criterion below before calling `update_card(completed)`."
    );
    lines.push(
      "For each criterion, collect concrete evidence (command output, test results, URLs)."
    );
    lines.push(
      "If any criterion cannot be met, call `update_card(blocked)` and explain why."
    );
    lines.push("");
    lines.push(card.acceptanceCriteria);
  }

  if (run.attempt > 1) {
    lines.push("");
    lines.push("## Retry Context");
    lines.push("");
    lines.push(
      `This is attempt #${run.attempt}. Previous attempts failed. Resume from the current state.`
    );
  }

  lines.push("");
  lines.push("## Board Columns");
  lines.push("");
  lines.push(`You are currently in: **${currentColumn.name}**`);
  lines.push("");
  lines.push(
    "Available columns (use the exact name in `next_column` when calling `update_card(completed)`):"
  );

  const sorted = [...boardColumns].sort((a, b) => a.position - b.position);
  for (const col of sorted) {
    let annotation = "";
    if (col.isTerminalState) {
      annotation = " — terminal (work is done)";
    } else if (col.isActiveState) {
      annotation = " — active (another agent will pick this up)";
    } else {
      annotation = " — inactive";
    }
    lines.push(`- **${col.name}**${annotation}`);
  }

  lines.push("");
  lines.push("## Instructions");
  lines.push("");
  lines.push(
    "Complete the task described above. Use the available tools to accomplish your work."
  );
  lines.push(
    "When you are done, call `update_card(completed)` with your summary, criteria_results for"
  );
  lines.push(
    "every acceptance criterion, and the exact column name to move this card to (from the list above)."
  );
  lines.push(
    "Call `update_card(in_progress)` periodically to report progress on long tasks."
  );
  lines.push(
    "Call `update_card(blocked)` only if you genuinely cannot proceed without human input."
  );
  lines.push(
    "Do not ask for human input in your messages — if stuck, use update_card(blocked)."
  );

  return lines.join("\n");
}
