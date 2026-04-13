function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function intEnv(name: string, defaultValue: number, min?: number, max?: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = parseInt(raw, 10);
  if (isNaN(value)) throw new Error(`${name} must be an integer, got: ${raw}`);
  if (min !== undefined && value < min) throw new Error(`${name} must be >= ${min}, got: ${value}`);
  if (max !== undefined && value > max) throw new Error(`${name} must be <= ${max}, got: ${value}`);
  return value;
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

export const config = {
  ANTHROPIC_API_KEY: requiredEnv("ANTHROPIC_API_KEY"),
  DATABASE_URL: optionalEnv("DATABASE_URL", "file:./dev.db")!,
  GITHUB_TOKEN: optionalEnv("GITHUB_TOKEN"),
  POLL_INTERVAL_MS: intEnv("POLL_INTERVAL_MS", 3000, 1000, 30000),
  MAX_CONCURRENT_AGENTS: intEnv("MAX_CONCURRENT_AGENTS", 5, 1),
  MAX_ATTEMPTS: intEnv("MAX_ATTEMPTS", 5, 1),
  MAX_RETRY_BACKOFF_MS: intEnv("MAX_RETRY_BACKOFF_MS", 300000, 1000),
  MAX_TURNS: intEnv("MAX_TURNS", 10, 1),
  MAX_STALL_MS: intEnv("MAX_STALL_MS", 3600000, 60000),
  CLI_ATTACH_COMMAND_TEMPLATE: optionalEnv("CLI_ATTACH_COMMAND_TEMPLATE", "ant sessions connect {session_id}")!,
} as const;

export function renderCliCommand(sessionId: string): string {
  return config.CLI_ATTACH_COMMAND_TEMPLATE.replace("{session_id}", sessionId);
}
