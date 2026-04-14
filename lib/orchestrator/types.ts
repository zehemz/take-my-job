import type { IDbQueries, IAnthropicClient, IBroadcaster } from '../interfaces'
import type { AgentRun, Card } from '../types'

export type OrchestratorDeps = {
  db: IDbQueries
  anthropic: IAnthropicClient
  broadcaster: IBroadcaster
}

export type OrchestratorState = {
  running: Map<string, { run: AgentRun; abortController: AbortController }>
  claimed: Set<string>
}

export type SpawnRunner = (card: Card, run: AgentRun) => void
