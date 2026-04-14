import type { FullConfig } from '@playwright/test';

/**
 * Runs once before all tests.
 * Verifies the dev server is reachable so tests fail fast with a clear message
 * instead of a flood of "connection refused" errors.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  let ok = false;
  try {
    const res = await fetch(baseURL, { redirect: 'follow' });
    ok = res.status < 500;
  } catch {
    ok = false;
  }

  if (!ok) {
    throw new Error(
      `\n\nE2E SETUP FAILED: cannot reach dev server at ${baseURL}\n` +
      `Start it first:  npm run dev\n\n`,
    );
  }
}
