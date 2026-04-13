import { Broadcaster } from './broadcaster';

// Use globalThis to survive Next.js hot-reload in dev.
const globalForBroadcaster = globalThis as unknown as {
  __kobani_broadcaster: Broadcaster | undefined;
};

export const broadcaster: Broadcaster =
  globalForBroadcaster.__kobani_broadcaster ??
  (globalForBroadcaster.__kobani_broadcaster = new Broadcaster());
