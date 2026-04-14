'use client';

import { useEffect, useState } from 'react';

let cachedRoles: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export function useRoles(): { roles: string[]; loading: boolean } {
  const isCacheValid = cachedRoles !== null && Date.now() - cacheTime < CACHE_TTL_MS;
  const [roles, setRoles] = useState<string[]>(isCacheValid ? cachedRoles! : []);
  const [loading, setLoading] = useState(!isCacheValid);

  useEffect(() => {
    if (isCacheValid) return;
    fetch('/api/roles')
      .then((r) => r.json())
      .then((data) => {
        cachedRoles = data.roles ?? [];
        cacheTime = Date.now();
        setRoles(cachedRoles!);
      })
      .catch(() => {
        cachedRoles = [];
        cacheTime = Date.now();
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { roles, loading };
}

/** Display label for a role string (hyphen/underscore to title case). */
export function roleLabel(role: string): string {
  return role
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_COLOR_PALETTE = [
  'bg-blue-900/50 text-blue-300 border-blue-700',
  'bg-green-900/50 text-green-300 border-green-700',
  'bg-purple-900/50 text-purple-300 border-purple-700',
  'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  'bg-orange-900/50 text-orange-300 border-orange-700',
  'bg-pink-900/50 text-pink-300 border-pink-700',
  'bg-cyan-900/50 text-cyan-300 border-cyan-700',
  'bg-red-900/50 text-red-300 border-red-700',
];

/** Deterministic color classes for a role string. */
export function roleColor(role: string): string {
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) | 0;
  return ROLE_COLOR_PALETTE[Math.abs(hash) % ROLE_COLOR_PALETTE.length];
}
