'use client';

import { useState } from 'react';
import type { AgentRow, AgentSyncStatus } from '@/lib/api-types';

function CopyableCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-xs text-zinc-400 truncate max-w-[160px]">{value}</span>
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

interface Props {
  items: AgentRow[];
}

export default function AgentConfigTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-600">
          No agents configured. Run scripts/setup-agents.ts to provision.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Role
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Name
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Model
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Agent ID
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Version
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
              Environment ID
            </th>
          </tr>
        </thead>
        <tbody className="bg-zinc-900 divide-y divide-zinc-800">
          {items.map((item) => (
            <tr key={item.anthropicAgentId} className="hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-3">
                <SyncStatusBadge status={item.syncStatus} />
              </td>
              <td className="px-4 py-3">
                {item.role != null ? (
                  <span className="text-zinc-100">{item.role}</span>
                ) : (
                  <span className="text-zinc-500 italic">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-100">{item.name}</td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-zinc-400">{item.model}</span>
              </td>
              <td className="px-4 py-3">
                <CopyableCell value={item.anthropicAgentId} />
              </td>
              <td className="px-4 py-3 text-zinc-400">{item.anthropicVersion}</td>
              <td className="px-4 py-3 hidden md:table-cell">
                {item.environmentId != null ? (
                  <CopyableCell value={item.environmentId} />
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
