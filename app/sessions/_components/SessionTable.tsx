'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SessionRow, SessionStatus } from '@/lib/api-types';

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

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  running: {
    label: 'Running',
    className: 'bg-blue-900 text-blue-300 border-l-blue-500',
  },
  idle: {
    label: 'Idle',
    className: 'bg-zinc-800 text-zinc-300 border-l-zinc-500',
  },
  terminated: {
    label: 'Terminated',
    className: 'bg-zinc-900 text-zinc-500 border-l-zinc-700',
  },
  rescheduling: {
    label: 'Rescheduling',
    className: 'bg-amber-900 text-amber-300 border-l-amber-500',
  },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-zinc-800 text-zinc-400 border-l-zinc-600' };
  return (
    <span className={`border-l-4 rounded-md px-2 py-0.5 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

interface Props {
  items: SessionRow[];
}

export default function SessionTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-600">No sessions found.</p>
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
              Title
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Agent
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Environment
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Card
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Role
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-zinc-900 divide-y divide-zinc-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-zinc-100">
                {item.title ?? <span className="text-zinc-500">—</span>}
              </td>
              <td className="px-4 py-3 text-zinc-100">{item.agentName}</td>
              <td className="px-4 py-3">
                {item.environmentId ? (
                  <CopyableCell value={item.environmentId} />
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {item.boardId && item.cardId ? (
                  <Link
                    href={`/boards/${item.boardId}`}
                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Card
                  </Link>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {item.agentRole ? (
                  <span className="text-zinc-100">{item.agentRole}</span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {new Date(item.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
