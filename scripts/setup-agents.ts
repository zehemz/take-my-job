import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const client = new Anthropic();
// The managed agents API is available at runtime but not yet typed in SDK 0.52.x
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const beta = client.beta as any;

const ROLES = [
  { key: "backend_engineer", displayName: "Backend Engineer" },
  { key: "qa", displayName: "QA Engineer" },
  { key: "tech_lead", displayName: "Tech Lead" },
];

const UPDATE_CARD_TOOL = {
  type: "custom" as const,
  name: "update_card",
  description:
    "Post a progress update or final result to the Kanban card. Use this to communicate what you have done and what remains. Call this at least once before completing your work. When status=completed, you MUST provide criteria_results for every acceptance criterion.",
  input_schema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["in_progress", "completed", "blocked"],
        description:
          "Current work status. Use 'blocked' only when you cannot proceed without human input.",
      },
      summary: {
        type: "string",
        description: "Markdown summary of work done so far or final result",
      },
      next_column: {
        type: "string",
        description:
          "If status=completed, the name of the column to move the card to (e.g. 'Review', 'Done')",
      },
      criteria_results: {
        type: "array",
        description:
          "Required when status=completed. One entry per acceptance criterion.",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string", description: "The exact criterion text" },
            passed: { type: "boolean", description: "Whether the criterion was met" },
            evidence: {
              type: "string",
              description: "Brief proof: test output, command result, URL, etc.",
            },
          },
          required: ["criterion", "passed", "evidence"],
        },
      },
      blocked_reason: {
        type: "string",
        description:
          "Required when status=blocked. Explain exactly what you need from a human to continue.",
      },
    },
    required: ["status", "summary"],
  },
};

async function setupEnvironment(): Promise<string> {
  const ENV_NAME = "kobani-env";

  // Check if we already have an environment stored in the DB
  const existingConfig = await prisma.agentConfig.findFirst();
  if (existingConfig?.anthropicEnvironmentId) {
    console.log(`Environment already exists: ${existingConfig.anthropicEnvironmentId}`);
    return existingConfig.anthropicEnvironmentId;
  }

  // Check Anthropic for an existing environment with the same name (find-or-create)
  const existing = await beta.environments.list({ limit: 100 });
  const match = (existing.data ?? []).find(
    (e: { name: string; archived_at: string | null }) =>
      e.name === ENV_NAME && !e.archived_at,
  );
  if (match) {
    console.log(`Found existing Anthropic environment "${ENV_NAME}": ${match.id}`);
    return match.id;
  }

  console.log("Creating shared environment...");
  const env = await beta.environments.create({
    name: ENV_NAME,
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });

  console.log(`Created environment: ${env.id}`);
  return env.id;
}

async function setupAgent(
  role: { key: string; displayName: string },
  environmentId: string,
): Promise<void> {
  const existing = await prisma.agentConfig.findUnique({
    where: { role: role.key },
  });

  if (existing) {
    console.log(`Agent for role "${role.key}" already exists (${existing.anthropicAgentId}), skipping.`);
    return;
  }

  // Check Anthropic for an existing agent with the same name (find-or-create).
  // This prevents orphaned agents when the script is run against a local DB
  // while pointing at the shared Anthropic account.
  const agentName = `kobani-${role.key}`;
  let agent: any = null;
  for await (const a of beta.agents.list()) {
    if (a.name === agentName && !a.archived_at) {
      agent = a;
      break;
    }
  }

  if (agent) {
    console.log(`Found existing Anthropic agent "${agentName}": ${agent.id}, linking to DB.`);
  } else {
    // Load system prompt from workflow file
    const workflowPath = join(process.cwd(), "workflows", `${role.key}.md`);
    let systemPrompt = `You are a ${role.displayName}.`;
    if (existsSync(workflowPath)) {
      systemPrompt = readFileSync(workflowPath, "utf-8");
      console.log(`Loaded workflow from ${workflowPath}`);
    } else {
      console.warn(`No workflow file at ${workflowPath}, using default system prompt.`);
    }

    console.log(`Creating agent for role "${role.key}"...`);
    agent = await beta.agents.create({
      model: "claude-opus-4-6",
      name: agentName,
      description: `Kobani ${role.displayName} agent`,
      system: systemPrompt,
      tools: [
        { type: "agent_toolset_20260401" },
        UPDATE_CARD_TOOL,
      ],
    });
  }

  const agentVersion = String(agent.version ?? "1");

  await prisma.agentConfig.create({
    data: {
      role: role.key,
      anthropicAgentId: agent.id,
      anthropicAgentVersion: agentVersion,
      anthropicEnvironmentId: environmentId,
    },
  });

  console.log(`Created agent for "${role.key}": ${agent.id} (version: ${agentVersion})`);
}

async function main() {
  console.log("=== Kobani Agent Setup ===\n");

  const environmentId = await setupEnvironment();

  for (const role of ROLES) {
    await setupAgent(role, environmentId);
  }

  console.log("\n=== Setup complete ===");
}

main()
  .catch((e) => {
    console.error("Setup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
