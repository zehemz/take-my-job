export function relativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`;
  return `${Math.floor(diffMs / 86_400_000)}d`;
}

export function isOlderThan(isoString: string | null | undefined, ms: number): boolean {
  if (!isoString) return false;
  return Date.now() - new Date(isoString).getTime() > ms;
}
