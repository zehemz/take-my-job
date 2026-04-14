'use client';

import { useState, useEffect } from 'react';
import type { EnvironmentNetworking } from '@/lib/api-types';

interface Props {
  networking: EnvironmentNetworking;
  onChange?: (networking: EnvironmentNetworking) => void;
  onSave?: (networking: EnvironmentNetworking) => Promise<void>;
  /** Hide the save button (used in creation flows where the parent handles submission). */
  inline?: boolean;
}

export default function NetworkEditor({ networking, onChange, onSave, inline }: Props) {
  const [type, setType] = useState<'unrestricted' | 'limited'>(networking.type);
  const [allowMcp, setAllowMcp] = useState(networking.allowMcpServers ?? false);
  const [allowPkg, setAllowPkg] = useState(networking.allowPackageManagers ?? false);
  const [hosts, setHosts] = useState<string[]>(networking.allowedHosts ?? []);
  const [newHost, setNewHost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when parent data changes
  useEffect(() => {
    setType(networking.type);
    setAllowMcp(networking.allowMcpServers ?? false);
    setAllowPkg(networking.allowPackageManagers ?? false);
    setHosts(networking.allowedHosts ?? []);
  }, [networking]);

  // Notify parent of changes in inline mode
  function emitChange(
    nextType: 'unrestricted' | 'limited',
    nextAllowMcp: boolean,
    nextAllowPkg: boolean,
    nextHosts: string[],
  ) {
    if (!onChange) return;
    if (nextType === 'unrestricted') {
      onChange({ type: 'unrestricted' });
    } else {
      onChange({
        type: 'limited',
        allowMcpServers: nextAllowMcp,
        allowPackageManagers: nextAllowPkg,
        allowedHosts: nextHosts,
      });
    }
  }

  function handleTypeChange(t: 'unrestricted' | 'limited') {
    setType(t);
    emitChange(t, allowMcp, allowPkg, hosts);
  }

  function handleMcpChange(v: boolean) {
    setAllowMcp(v);
    emitChange(type, v, allowPkg, hosts);
  }

  function handlePkgChange(v: boolean) {
    setAllowPkg(v);
    emitChange(type, allowMcp, v, hosts);
  }

  function addHost() {
    const h = newHost.trim();
    if (h && !hosts.includes(h)) {
      const next = [...hosts, h];
      setHosts(next);
      setNewHost('');
      emitChange(type, allowMcp, allowPkg, next);
    }
  }

  function removeHost(host: string) {
    const next = hosts.filter((h) => h !== host);
    setHosts(next);
    emitChange(type, allowMcp, allowPkg, next);
  }

  function handleHostKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHost();
    }
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      if (type === 'unrestricted') {
        await onSave({ type: 'unrestricted' });
      } else {
        await onSave({
          type: 'limited',
          allowMcpServers: allowMcp,
          allowPackageManagers: allowPkg,
          allowedHosts: hosts,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-300">Network Policy</h3>

      {/* Type toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="net-type"
            checked={type === 'unrestricted'}
            onChange={() => handleTypeChange('unrestricted')}
            className="accent-emerald-500"
          />
          <span className="text-sm text-zinc-300">Unrestricted</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="net-type"
            checked={type === 'limited'}
            onChange={() => handleTypeChange('limited')}
            className="accent-amber-500"
          />
          <span className="text-sm text-zinc-300">Limited</span>
        </label>
      </div>

      {/* Limited options */}
      {type === 'limited' && (
        <div className="space-y-3 pl-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMcp}
              onChange={(e) => handleMcpChange(e.target.checked)}
              className="accent-zinc-500 rounded"
            />
            <span className="text-sm text-zinc-400">Allow MCP server access</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowPkg}
              onChange={(e) => handlePkgChange(e.target.checked)}
              className="accent-zinc-500 rounded"
            />
            <span className="text-sm text-zinc-400">Allow package manager access</span>
          </label>

          {/* Allowed hosts */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Allowed Hosts</p>
            <div className="flex flex-wrap gap-2">
              {hosts.map((host) => (
                <span
                  key={host}
                  className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300"
                >
                  {host}
                  <button
                    onClick={() => removeHost(host)}
                    className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove host"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
                onKeyDown={handleHostKeyDown}
                placeholder="e.g. api.example.com"
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 w-64"
              />
              <button
                onClick={addHost}
                className="px-3 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {!inline && onSave && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving\u2026' : 'Save Network'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
