'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopNav from '@/app/_components/TopNav';
import type { AgentDetail, AgentSyncStatus, PatchAgentResponse } from '@/lib/api-types';

// ─── Constants ───────────────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
] as const;

const AVAILABLE_ROLES = [
  { value: 'backend-engineer', label: 'Backend Engineer' },
  { value: 'qa-engineer', label: 'QA Engineer' },
  { value: 'tech-lead', label: 'Tech Lead' },
  { value: 'content-writer', label: 'Content Writer' },
  { value: 'product-spec-writer', label: 'Product Spec Writer' },
  { value: 'designer', label: 'Designer' },
] as const;

const SYSTEM_PROMPT_MAX = 100_000;

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
  disabled,
  prefix,
  multiline,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  prefix?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const displayValue = prefix ? value.replace(new RegExp(`^${prefix}`), '') : value;

  function startEdit() {
    setDraft(prefix ? value.replace(new RegExp(`^${prefix}`), '') : value);
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
      const finalValue = prefix ? prefix + draft : draft;
      await onSave(finalValue);
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
          {!disabled && (
            <button
              onClick={startEdit}
              className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
              title={`Edit ${label.toLowerCase()}`}
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </Field>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {prefix && <span className="text-sm text-zinc-500 font-mono">{prefix}</span>}
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 w-full"
            />
          )}
        </div>
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

// ─── Editable textarea (system prompt) ────────────────────────────────────────

function EditableTextarea({
  label,
  value,
  onSave,
  disabled,
  maxLength,
  requireConfirm,
  confirmMessage,
}: {
  label: string;
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  disabled?: boolean;
  maxLength?: number;
  requireConfirm?: boolean;
  confirmMessage?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  function startEdit() {
    setDraft(value ?? '');
    setFieldError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFieldError(null);
  }

  async function handleSave() {
    if (requireConfirm) {
      const ok = window.confirm(confirmMessage ?? 'Are you sure you want to save?');
      if (!ok) return;
    }
    setSaving(true);
    setFieldError(null);
    try {
      await onSave(draft || null);
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
          {!disabled && (
            <button
              onClick={startEdit}
              className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5 mt-0.5"
              title={`Edit ${label.toLowerCase()}`}
            >
              <PencilIcon />
            </button>
          )}
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
          rows={6}
          maxLength={maxLength}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 resize-y"
        />
        {maxLength && (
          <p className="text-xs text-zinc-500">
            {draft.length.toLocaleString()} / {maxLength.toLocaleString()} characters
          </p>
        )}
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

// ─── Editable select field ────────────────────────────────────────────────────

function EditableSelect({
  label,
  value,
  options,
  onSave,
  disabled,
}: {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value;

  function startEdit() {
    setDraft(value ?? '');
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
          {value ? (
            <span className="font-mono text-xs text-zinc-300">{displayLabel}</span>
          ) : (
            <span className="text-zinc-500 italic">--</span>
          )}
          {!disabled && (
            <button
              onClick={startEdit}
              className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
              title={`Edit ${label.toLowerCase()}`}
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </Field>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-60 w-full"
        >
          <option value="">-- Select --</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState<number>(0);
  const [versionConflict, setVersionConflict] = useState(false);

  const fetchAgent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setVersionConflict(false);
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
      setVersion(parseInt(data.anthropicVersion, 10) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  const isOrphaned = agent?.syncStatus === 'orphaned';

  async function patchAgent(field: string, value: unknown): Promise<PatchAgentResponse | null> {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value, version }),
    });
    if (res.status === 409) {
      const data = await res.json();
      if (data.error === 'version_conflict') {
        setVersionConflict(true);
        return null;
      }
      if (data.error === 'role_conflict') {
        throw new Error(data.message);
      }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(data.error || 'Failed to save');
    }
    const data: PatchAgentResponse = await res.json();
    setAgent(data.agent);
    setVersion(data.newVersion);
    return data;
  }

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
              {/* Orphaned banner */}
              {isOrphaned && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
                  This agent no longer exists in Anthropic. Editing is disabled.
                </div>
              )}

              {/* Version conflict banner */}
              {versionConflict && (
                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg text-sm text-yellow-300 flex items-center justify-between">
                  <span>This agent was modified since you loaded it.</span>
                  <button
                    onClick={fetchAgent}
                    className="px-3 py-1 text-xs font-medium bg-yellow-800 hover:bg-yellow-700 text-yellow-200 rounded transition-colors cursor-pointer"
                  >
                    Reload
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                {/* Row 1: Status (read-only) | Role (editable select) */}
                <Field label="Status">
                  <SyncStatusBadge status={agent.syncStatus} />
                </Field>

                <EditableSelect
                  label="Role"
                  value={agent.role}
                  options={AVAILABLE_ROLES}
                  onSave={async (v) => { await patchAgent('role', v); }}
                  disabled={isOrphaned}
                />

                {/* Row 2: Model (editable select) | Version (read-only) */}
                <EditableSelect
                  label="Model"
                  value={agent.model}
                  options={AVAILABLE_MODELS}
                  onSave={async (v) => { await patchAgent('model', v); }}
                  disabled={isOrphaned}
                />

                <Field label="Version">
                  <span className="font-mono text-xs text-zinc-300">{agent.anthropicVersion || '--'}</span>
                </Field>

                {/* Row 3: Name (editable text with kobani- prefix) | Agent ID (read-only) */}
                <EditableTextField
                  label="Name"
                  value={agent.name}
                  prefix="kobani-"
                  onSave={async (v) => { await patchAgent('name', v); }}
                  disabled={isOrphaned}
                />

                <Field label="Agent ID">
                  <CopyableValue value={agent.anthropicAgentId} />
                </Field>

                {/* Row 4: Created at (read-only) | Archived at (read-only) */}
                <Field label="Created at">
                  {new Date(agent.createdAt).toLocaleDateString('en-GB')}
                </Field>

                <Field label="Archived at">
                  {agent.archivedAt
                    ? new Date(agent.archivedAt).toLocaleDateString('en-GB')
                    : <span className="text-zinc-500 italic">--</span>}
                </Field>

                {/* Row 5: Description (editable textarea, full width) */}
                <EditableTextarea
                  label="Description"
                  value={agent.description}
                  onSave={async (v) => { await patchAgent('description', v); }}
                  disabled={isOrphaned}
                />

                {/* Row 6: System Prompt (editable textarea, full width, with char count + confirm) */}
                <EditableTextarea
                  label="System Prompt"
                  value={agent.system}
                  onSave={async (v) => { await patchAgent('system', v); }}
                  disabled={isOrphaned}
                  maxLength={SYSTEM_PROMPT_MAX}
                  requireConfirm
                  confirmMessage="Changing the system prompt will alter this agent's behavior. Save changes?"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
