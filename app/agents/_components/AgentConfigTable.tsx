'use client';

import { useState } from 'react';
import type { AgentConfigItem } from '@/lib/api-types';

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

interface Props {
  items: AgentConfigItem[];
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
              Role
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Agent ID
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Version
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Environment ID
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-zinc-900 divide-y divide-zinc-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-3 text-zinc-100">{item.role}</td>
              <td className="px-4 py-3">
                <CopyableCell value={item.anthropicAgentId} />
              </td>
              <td className="px-4 py-3 text-zinc-400">{item.anthropicAgentVersion}</td>
              <td className="px-4 py-3">
                <CopyableCell value={item.anthropicEnvironmentId} />
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {new Date(item.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
