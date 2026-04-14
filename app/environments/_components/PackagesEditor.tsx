'use client';

import { useState, useEffect } from 'react';
import type { EnvironmentPackages } from '@/lib/api-types';

const PACKAGE_MANAGERS = ['apt', 'npm', 'pip', 'cargo', 'gem', 'go'] as const;
type PkgManager = (typeof PACKAGE_MANAGERS)[number];

const PKG_LABELS: Record<PkgManager, string> = {
  apt: 'APT packages',
  npm: 'NPM packages',
  pip: 'PIP packages',
  cargo: 'Cargo packages',
  gem: 'Gem packages',
  go: 'Go packages',
};

function toDrafts(packages: EnvironmentPackages): Record<PkgManager, string> {
  const d: Record<string, string> = {};
  for (const m of PACKAGE_MANAGERS) {
    d[m] = packages[m].join(', ');
  }
  return d as Record<PkgManager, string>;
}

function draftsToPackages(drafts: Record<PkgManager, string>): EnvironmentPackages {
  const result: Record<string, string[]> = {};
  for (const m of PACKAGE_MANAGERS) {
    result[m] = drafts[m]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return result as unknown as EnvironmentPackages;
}

interface Props {
  packages: EnvironmentPackages;
  onChange?: (packages: EnvironmentPackages) => void;
  onSave?: (packages: EnvironmentPackages) => Promise<void>;
  /** Hide the save button (used in creation flows where the parent handles submission). */
  inline?: boolean;
}

export default function PackagesEditor({ packages, onChange, onSave, inline }: Props) {
  const [drafts, setDrafts] = useState<Record<PkgManager, string>>(() => toDrafts(packages));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when parent data changes
  useEffect(() => {
    setDrafts(toDrafts(packages));
  }, [packages]);

  function updateDraft(manager: PkgManager, value: string) {
    const next = { ...drafts, [manager]: value };
    setDrafts(next);
    onChange?.(draftsToPackages(next));
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draftsToPackages(drafts));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-300">Packages</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {PACKAGE_MANAGERS.map((m) => (
          <div key={m} className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {PKG_LABELS[m]}
            </label>
            <input
              type="text"
              value={drafts[m]}
              onChange={(e) => updateDraft(m, e.target.value)}
              disabled={saving}
              placeholder="e.g. package1, package2"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
            />
          </div>
        ))}
      </div>
      {!inline && onSave && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving\u2026' : 'Save Packages'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
