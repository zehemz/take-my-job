'use client';

import { useState, useEffect, useCallback } from 'react';
import TopNav from '@/app/_components/TopNav';
import SessionTable from './_components/SessionTable';
import type { SessionRow, PaginatedResponse } from '@/lib/api-types';

export default function SessionsPage() {
  const [items, setItems] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<string | null>(null);

  const fetchSessions = useCallback(async (page?: string) => {
    if (page) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load sessions from Anthropic.');
      }
      const data: PaginatedResponse<SessionRow> = await res.json();
      setItems((prev) => page ? [...prev, ...data.items] : data.items);
      setNextPage(data.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions from Anthropic.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Sessions</h1>
          <p className="text-sm text-zinc-500 mt-1">Live data from Anthropic · correlated with Kobani AgentRun records</p>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <>
            <SessionTable items={items} onRefresh={() => fetchSessions()} />
            {nextPage && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => fetchSessions(nextPage)}
                  disabled={loadingMore}
                  className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
