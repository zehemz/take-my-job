'use client';
import { useEffect, useState } from 'react';
import type { EnvironmentRow } from './api-types';

let cachedEnvironments: EnvironmentRow[] | null = null;

export function useEnvironments(): { environments: EnvironmentRow[]; loading: boolean } {
  const [environments, setEnvironments] = useState<EnvironmentRow[]>(cachedEnvironments ?? []);
  const [loading, setLoading] = useState(cachedEnvironments === null);

  useEffect(() => {
    if (cachedEnvironments) return;
    fetch('/api/environments')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        cachedEnvironments = Array.isArray(data) ? data : [];
        setEnvironments(cachedEnvironments);
      })
      .catch(() => {
        cachedEnvironments = [];
        setEnvironments([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { environments, loading };
}
