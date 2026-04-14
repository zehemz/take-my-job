import { Orchestrator } from './orchestrator';
import { dbQueries } from './db-queries';
import { broadcaster } from './broadcaster-singleton';
import { anthropicClient } from './anthropic-client';
import { run as runAgent, resumeBlocked } from './agent-runner';
import type { SpawnRunner, SpawnResumeRunner } from './orchestrator/types';
import type { Card, Column } from './types';

const globalForOrchestrator = globalThis as unknown as {
  __kobani_orchestrator: Orchestrator | undefined;
};

function createOrchestrator(): Orchestrator {
  const spawnRunner: SpawnRunner = (card, agentRun) => {
    // The orchestrator always fetches cards with column included before calling spawnRunner.
    // Cast to satisfy the agent runner's stricter signature.
    const cardWithColumn = card as Card & { column: Column };
    // Fire-and-forget — the orchestrator manages the lifecycle
    runAgent(cardWithColumn, agentRun, { db: dbQueries, anthropicClient, broadcaster }).catch((err) => {
      console.error('[orchestrator] agent runner error:', err);
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

export const orchestrator: Orchestrator =
  globalForOrchestrator.__kobani_orchestrator ??
  (globalForOrchestrator.__kobani_orchestrator = createOrchestrator());
