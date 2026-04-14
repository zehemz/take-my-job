'use client';

import { useState, useEffect, useCallback } from 'react';
import TopNav from '@/app/_components/TopNav';
import EnvironmentTable from './_components/EnvironmentTable';
import CreateEnvironmentModal from './_components/CreateEnvironmentModal';
import type { EnvironmentRow } from '@/lib/api-types';

export default function EnvironmentsPage() {
  const [items, setItems] = useState<EnvironmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/environments');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load environments from Anthropic.');
      }
      const data: EnvironmentRow[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environments from Anthropic.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/environments/${id}`, { method: 'DELETE' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      throw new Error('Failed to delete environment.');
    }
    await fetchEnvironments();
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Environments</h1>
            <p className="text-sm text-zinc-500 mt-1">Live data from Anthropic</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded transition-colors cursor-pointer"
          >
            Create Environment
          </button>
        </div>
        <CreateEnvironmentModal open={showCreate} onClose={() => setShowCreate(false)} />
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <EnvironmentTable items={items} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
