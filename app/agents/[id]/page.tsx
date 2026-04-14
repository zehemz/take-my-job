'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopNav from '@/app/_components/TopNav';
import type { AgentDetail, AgentSyncStatus } from '@/lib/api-types';

// ─── Sync status badge ────────────────────────────────────────────────────────

const syncStatusConfig: Record<AgentSyncStatus, { label: string; className: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-emerald-900 text-emerald-300 border-l-emerald-500',
  },
  unmapped: {
    label: 'Unmapped',
    className: 'bg-amber-900 text-amber-300 border-l-amber-500',
  },
  orphaned: {
    label: 'Orphaned',
    className: 'bg-red-900 text-red-300 border-l-red-500',
  },
};

function SyncStatusBadge({ status }: { status: AgentSyncStatus }) {
  const { label, className } = syncStatusConfig[status];
  return (
    <span className={`border-l-4 rounded-md px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

// ─── Copyable value ───────────────────────────────────────────────────────────

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-xs text-zinc-300 truncate">{value}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
        title="Copy to clipboard"
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonField() {
  return <div className="animate-pulse bg-zinc-800 h-4 rounded w-40" />;
}

function LoadingSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      <div className="animate-pulse bg-zinc-800 h-5 rounded w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="animate-pulse bg-zinc-800 h-3 rounded w-20" />
            <SkeletonField />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Field label + value pair ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="text-sm text-zinc-200">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchAgent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load agent details.');
      }
      const data: AgentDetail = await res.json();
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8 max-w-4xl">
        {/* Back link */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-100 transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Agents
        </Link>

        {loading ? (
          <LoadingSkeleton />
        ) : notFound ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
            <p className="text-zinc-100 font-medium">Agent not found</p>
            <p className="text-sm text-zinc-500">No agent with ID <span className="font-mono text-zinc-400">{id}</span> exists on Anthropic.</p>
            <Link href="/agents" className="inline-block mt-2 text-sm text-zinc-400 hover:text-zinc-100 underline transition-colors">
              Back to Agents
            </Link>
          </div>
        ) : error ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchAgent}
              className="text-sm text-zinc-400 hover:text-zinc-100 underline transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : agent ? (
          <div className="space-y-4">
            <div className="mb-2">
              <h1 className="text-xl font-semibold text-zinc-100">{agent.name}</h1>
              <p className="text-sm text-zinc-500 mt-1">Agent detail</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <Field label="Status">
                  <SyncStatusBadge status={agent.syncStatus} />
                </Field>

                <Field label="Role">
                  {agent.role ?? <span className="text-zinc-500 italic">—</span>}
                </Field>

                <Field label="Model">
                  <span className="font-mono text-xs text-zinc-300">{agent.model || '—'}</span>
                </Field>

                <Field label="Version">
                  <span className="font-mono text-xs text-zinc-300">{agent.anthropicVersion || '—'}</span>
                </Field>

                <Field label="Agent ID">
                  <CopyableValue value={agent.anthropicAgentId} />
                </Field>

                <Field label="Created at">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </Field>

                <Field label="Archived at">
                  {agent.archivedAt
                    ? new Date(agent.archivedAt).toLocaleDateString()
                    : <span className="text-zinc-500 italic">—</span>}
                </Field>

                <Field label="Description">
                  {agent.description ?? <span className="text-zinc-500 italic">—</span>}
                </Field>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
