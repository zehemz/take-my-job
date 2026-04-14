'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopNav from '@/app/_components/TopNav';
import type {
  EnvironmentDetail,
  EnvironmentNetworking,
  EnvironmentPackages,
  PatchEnvironmentRequest,
  PatchEnvironmentResponse,
} from '@/lib/api-types';

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
        {Array.from({ length: 6 }).map((_, i) => (
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

// ─── Pencil icon ──────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

// ─── Editable text field ──────────────────────────────────────────────────────

function EditableTextField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function startEdit() {
    setDraft(value);
    setFieldError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFieldError(null);
  }

  async function handleSave() {
    setSaving(true);
    setFieldError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Field label={label}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200">
            {value || <span className="text-zinc-500 italic">--</span>}
          </span>
          <button
            onClick={startEdit}
            className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
            title={`Edit ${label.toLowerCase()}`}
          >
            <PencilIcon />
          </button>
        </div>
      </Field>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 w-full"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
        {fieldError && <p className="text-xs text-red-400">{fieldError}</p>}
      </div>
    </div>
  );
}

// ─── Editable textarea ──────────────────────────────────────────────────────

function EditableTextarea({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function startEdit() {
    setDraft(value);
    setFieldError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFieldError(null);
  }

  async function handleSave() {
    setSaving(true);
    setFieldError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-1 sm:col-span-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <div className="flex items-start gap-2">
          <span className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
            {value || <span className="text-zinc-500 italic">--</span>}
          </span>
          <button
            onClick={startEdit}
            className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5 mt-0.5"
            title={`Edit ${label.toLowerCase()}`}
          >
            <PencilIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:col-span-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 resize-y"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
        {fieldError && <p className="text-xs text-red-400">{fieldError}</p>}
      </div>
    </div>
  );
}

// ─── Network editor ─────────────────────────────────────────────────────────

function NetworkEditor({
  networking,
  onSave,
}: {
  networking: EnvironmentNetworking;
  onSave: (networking: EnvironmentNetworking) => Promise<void>;
}) {
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

  function addHost() {
    const h = newHost.trim();
    if (h && !hosts.includes(h)) {
      setHosts([...hosts, h]);
      setNewHost('');
    }
  }

  function removeHost(host: string) {
    setHosts(hosts.filter((h) => h !== host));
  }

  function handleHostKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHost();
    }
  }

  async function handleSave() {
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
            onChange={() => setType('unrestricted')}
            className="accent-emerald-500"
          />
          <span className="text-sm text-zinc-300">Unrestricted</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="net-type"
            checked={type === 'limited'}
            onChange={() => setType('limited')}
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
              onChange={(e) => setAllowMcp(e.target.checked)}
              className="accent-zinc-500 rounded"
            />
            <span className="text-sm text-zinc-400">Allow MCP server access</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowPkg}
              onChange={(e) => setAllowPkg(e.target.checked)}
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving\u2026' : 'Save Network'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Packages editor ────────────────────────────────────────────────────────

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

function PackagesEditor({
  packages,
  onSave,
}: {
  packages: EnvironmentPackages;
  onSave: (packages: EnvironmentPackages) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<PkgManager, string>>(() => {
    const d: Record<string, string> = {};
    for (const m of PACKAGE_MANAGERS) {
      d[m] = packages[m].join(', ');
    }
    return d as Record<PkgManager, string>;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when parent data changes
  useEffect(() => {
    const d: Record<string, string> = {};
    for (const m of PACKAGE_MANAGERS) {
      d[m] = packages[m].join(', ');
    }
    setDrafts(d as Record<PkgManager, string>);
  }, [packages]);

  function updateDraft(manager: PkgManager, value: string) {
    setDrafts((prev) => ({ ...prev, [manager]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result: Record<string, string[]> = {};
      for (const m of PACKAGE_MANAGERS) {
        result[m] = drafts[m]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      await onSave(result as unknown as EnvironmentPackages);
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
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving\u2026' : 'Save Packages'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function EnvironmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [env, setEnv] = useState<EnvironmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnv = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/environments/${id}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 404) {
        setError('Environment not found');
        return;
      }
      if (!res.ok) throw new Error('Failed to load environment');
      const data: EnvironmentDetail = await res.json();
      setEnv(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEnv();
  }, [fetchEnv]);

  async function patchEnvironment(updates: Partial<PatchEnvironmentRequest>) {
    const res = await fetch(`/api/environments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(data.error || 'Failed to save');
    }
    const data: PatchEnvironmentResponse = await res.json();
    setEnv(data.environment);
    return data;
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/environments"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            &larr; Environments
          </Link>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : env ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
            {/* Row 1: Name | ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <EditableTextField
                label="Name"
                value={env.name}
                onSave={async (v) => { await patchEnvironment({ name: v }); }}
              />
              <Field label="ID">
                <CopyableValue value={env.id} />
              </Field>
            </div>

            {/* Row 2: Created | Updated */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <Field label="Created">
                {new Date(env.createdAt).toLocaleString('en-GB')}
              </Field>
              <Field label="Updated">
                {new Date(env.updatedAt).toLocaleString('en-GB')}
              </Field>
            </div>

            {/* Row 3: Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <EditableTextarea
                label="Description"
                value={env.description}
                onSave={async (v) => { await patchEnvironment({ description: v || null }); }}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Network Policy */}
            <NetworkEditor
              networking={env.networking}
              onSave={async (networking) => { await patchEnvironment({ networking }); }}
            />

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Packages */}
            <PackagesEditor
              packages={env.packages}
              onSave={async (packages) => { await patchEnvironment({ packages }); }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
