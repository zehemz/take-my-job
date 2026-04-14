import type { IDbQueries, IAnthropicClient } from '../interfaces'
import type { AgentRun, Card, Column } from '../types'

export type OrchestratorDeps = {
  db: IDbQueries
  anthropic: IAnthropicClient
}

export type SpawnRunner = (card: Card, run: AgentRun) => void
export type SpawnResumeRunner = (card: Card & { column: Column }, run: AgentRun) => void
