'use client';

import { useState } from 'react';
import type { EnvironmentRow } from '@/lib/api-types';

function Spinner() {
  return (
    <svg
      className="animate-spin w-3 h-3 text-zinc-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

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

function NetworkBadge({ type }: { type: 'unrestricted' | 'limited' }) {
  const className =
    type === 'unrestricted'
      ? 'bg-emerald-900 text-emerald-300 border-l-emerald-500'
      : 'bg-amber-900 text-amber-300 border-l-amber-500';
  const label = type === 'unrestricted' ? 'Unrestricted' : 'Limited';
  return (
    <span className={`border-l-4 rounded-md px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

interface RowDeleteCellProps {
  id: string;
  onDelete: (id: string) => Promise<void>;
}

function RowDeleteCell({ id, onDelete }: RowDeleteCellProps) {
  const [state, setState] = useState<DeleteState>('idle');

  async function handleConfirm() {
    setState('deleting');
    try {
      await onDelete(id);
    } finally {
      setState('idle');
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={() => setState('confirming')}
        className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
      >
        Delete
      </button>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">Confirm?</span>
        <button
          onClick={handleConfirm}
          className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
        >
          Yes
        </button>
        <button
          onClick={() => setState('idle')}
          className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </span>
    );
  }

  // deleting
  return (
    <span className="flex items-center gap-1.5 text-sm text-zinc-500">
      <Spinner />
      Deleting…
    </span>
  );
}

interface Props {
  items: EnvironmentRow[];
  onDelete: (id: string) => Promise<void>;
}

export default function EnvironmentTable({ items, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-600">No environments found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Name
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Description
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Network
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              ID
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Created
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-zinc-900 divide-y divide-zinc-800">
          {items.map((item) => {
            const desc = item.description
              ? item.description.length > 60
                ? item.description.slice(0, 60) + '…'
                : item.description
              : null;
            const created = new Date(item.createdAt).toLocaleDateString('en-GB');

            return (
              <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3 text-zinc-100">{item.name}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {desc ?? <span className="text-zinc-600 italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  <NetworkBadge type={item.networkType} />
                </td>
                <td className="px-4 py-3">
                  <CopyableCell value={item.id} />
                </td>
                <td className="px-4 py-3 text-zinc-400">{created}</td>
                <td className="px-4 py-3">
                  <RowDeleteCell id={item.id} onDelete={onDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
