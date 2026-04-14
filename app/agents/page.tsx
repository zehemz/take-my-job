'use client';

import { useState, useEffect, useCallback } from 'react';
import TopNav from '@/app/_components/TopNav';
import AgentConfigTable from './_components/AgentConfigTable';
import type { AgentRow } from '@/lib/api-types';

export default function AgentsPage() {
  const [items, setItems] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load agents from Anthropic.');
      }
      const data: AgentRow[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents from Anthropic.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  async function handleDelete(anthropicAgentId: string) {
    const res = await fetch(`/api/agents/${anthropicAgentId}`, { method: 'DELETE' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      throw new Error('Failed to delete agent.');
    }
    await fetchAgents();
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">Live data from Anthropic · role mapping from local DB</p>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <AgentConfigTable items={items} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
