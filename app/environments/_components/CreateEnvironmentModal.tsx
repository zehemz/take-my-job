'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EnvironmentNetworking,
  EnvironmentPackages,
  CreateEnvironmentRequest,
  CreateEnvironmentResponse,
} from '@/lib/api-types';
import { ENVIRONMENT_PRESETS, type EnvironmentPreset } from '@/lib/environment-presets';
import NetworkEditor from './NetworkEditor';
import PackagesEditor from './PackagesEditor';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateEnvironmentModal({ open, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedPreset, setSelectedPreset] = useState<EnvironmentPreset>(ENVIRONMENT_PRESETS[0]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [networking, setNetworking] = useState<EnvironmentNetworking>(ENVIRONMENT_PRESETS[0].networking);
  const [packages, setPackages] = useState<EnvironmentPackages>(ENVIRONMENT_PRESETS[0].packages);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync dialog open/close with the `open` prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handlePresetSelect(preset: EnvironmentPreset) {
    setSelectedPreset(preset);
    setNetworking({ ...preset.networking });
    setPackages({
      apt: [...preset.packages.apt],
      npm: [...preset.packages.npm],
      pip: [...preset.packages.pip],
      cargo: [...preset.packages.cargo],
      gem: [...preset.packages.gem],
      go: [...preset.packages.go],
    });
  }

  function resetForm() {
    const blank = ENVIRONMENT_PRESETS[0];
    setSelectedPreset(blank);
    setName('');
    setDescription('');
    setNetworking(blank.networking);
    setPackages(blank.packages);
    setError(null);
    setCreating(false);
  }

  function handleClose() {
    if (creating) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const body: CreateEnvironmentRequest = {
        name: name.trim(),
        description: description.trim() || null,
        networking,
        packages,
      };
      const res = await fetch('/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Failed to create environment');
      }
      const data: CreateEnvironmentResponse = await res.json();
      resetForm();
      onClose();
      router.push(`/environments/${data.environment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create environment');
    } finally {
      setCreating(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-0 w-full max-w-3xl max-h-[90vh] overflow-y-auto backdrop:bg-black/60"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Create Environment</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={creating}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Preset selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Start from a preset</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ENVIRONMENT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                  selectedPreset.key === preset.key
                    ? 'border-zinc-500 bg-zinc-800'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <p className="text-sm font-medium text-zinc-200">{preset.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800" />

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            placeholder="e.g. Backend Production"
            maxLength={256}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={creating}
            rows={2}
            placeholder="Optional description"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 resize-y"
          />
        </div>

        <div className="border-t border-zinc-800" />

        {/* Network */}
        <NetworkEditor networking={networking} onChange={setNetworking} inline />

        <div className="border-t border-zinc-800" />

        {/* Packages */}
        <PackagesEditor packages={packages} onChange={setPackages} inline />

        <div className="border-t border-zinc-800" />

        {/* Actions */}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={creating}
            className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating\u2026' : 'Create Environment'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
