import { Orchestrator } from './orchestrator';
import { dbQueries } from './db-queries';
import { broadcaster } from './broadcaster-singleton';
import { anthropicClient } from './anthropic-client';
import { run as runAgent, resumeBlocked } from './agent-runner';
import type { SpawnRunner, SpawnResumeRunner } from './orchestrator/types';
import type { Card, Column } from './types';

// Bump this version string whenever the Orchestrator class gains new methods so
// Next.js dev-mode HMR doesn't serve a stale globalThis instance without them.
const ORCHESTRATOR_VERSION = 'v2-unclaim';

const globalForOrchestrator = globalThis as unknown as {
  __kobani_orchestrator: Orchestrator | undefined;
  __kobani_orchestrator_version: string | undefined;
};

function createOrchestrator(): Orchestrator {
  const spawnRunner: SpawnRunner = (card, agentRun) => {
    // The orchestrator always fetches cards with column included before calling spawnRunner.
    // Cast to satisfy the agent runner's stricter signature.
    const cardWithColumn = card as Card & { column: Column };
    // Fire-and-forget — the orchestrator manages the lifecycle.
    // Release the claim when the run settles so the next poll tick can dispatch retries.
    runAgent(cardWithColumn, agentRun, { db: dbQueries, anthropicClient, broadcaster })
      .catch((err) => {
        console.error('[orchestrator] agent runner error:', err);
      })
      .finally(() => {
        globalForOrchestrator.__kobani_orchestrator?.unclaim(card.id);
      });
  };

  const spawnResumeRunner: SpawnResumeRunner = (card, agentRun, signal) => {
    resumeBlocked(card, agentRun, { db: dbQueries, anthropicClient, broadcaster }, signal).catch((err) => {
      console.error('[orchestrator] resume runner error:', err);
    });
  };

  const orchestrator = new Orchestrator(
    { db: dbQueries, anthropic: anthropicClient, broadcaster },
    spawnRunner,
    spawnResumeRunner,
  );

  orchestrator.start().catch((err) => {
    console.error('[orchestrator] failed to start:', err);
  });

  return orchestrator;
}

// If the cached singleton is from an older version, stop it and recreate.
if (
  globalForOrchestrator.__kobani_orchestrator &&
  globalForOrchestrator.__kobani_orchestrator_version !== ORCHESTRATOR_VERSION
) {
  globalForOrchestrator.__kobani_orchestrator.stop();
  globalForOrchestrator.__kobani_orchestrator = undefined;
}

export const orchestrator: Orchestrator =
  globalForOrchestrator.__kobani_orchestrator ??
  (globalForOrchestrator.__kobani_orchestrator = createOrchestrator());

globalForOrchestrator.__kobani_orchestrator_version = ORCHESTRATOR_VERSION;
