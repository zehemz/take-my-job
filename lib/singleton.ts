import { Broadcaster } from './broadcaster';

/**
 * Module-level singleton for the Broadcaster instance.
 *
 * Stored on globalThis so that Next.js HMR in development does not create a
 * fresh instance on every module re-evaluation, which would cause API route
 * handlers and the orchestrator to hold references to different Broadcaster
 * instances.
 */
declare global {
  // eslint-disable-next-line no-var
  var __kobani_broadcaster: Broadcaster | undefined;
}

export const broadcaster: Broadcaster =
  globalThis.__kobani_broadcaster ?? new Broadcaster();

globalThis.__kobani_broadcaster = broadcaster;
