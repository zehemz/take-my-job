'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useKobaniStore } from '@/lib/store';
import type { CardDraft } from '@/app/api/projects/parse/route';
import type { EnvironmentRow } from '@/lib/api-types';
import { useRoles, roleLabel, roleColor } from '@/lib/useRoles';

interface Props {
  onClose: () => void;
}

type Step = 'input' | 'preview';

export default function NewBoardModal({ onClose }: Props) {
  const router = useRouter();
  const createBoardApi = useKobaniStore((s) => s.createBoardApi);
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);
  const createCardApi = useKobaniStore((s) => s.createCardApi);
  const { roles } = useRoles();

  const [step, setStep] = useState<Step>('input');
  const [name, setName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [environments, setEnvironments] = useState<EnvironmentRow[]>([]);
  const [envLoading, setEnvLoading] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CardDraft[]>([]);

  useEffect(() => {
    fetch('/api/environments', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.items) setEnvironments(data.items); })
      .catch(() => {})
      .finally(() => setEnvLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;

    // No spec — fast path, create board immediately
    if (!spec.trim()) {
      setLoading(true);
      setError(null);
      try {
        const id = await createBoardApi(name.trim(), workspacePath.trim() || undefined, environmentId || undefined, autoMode);
        if (id) router.push(`/boards/${id}`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Spec provided — call Claude to generate cards, show preview
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setDrafts(data.cards);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const boardId = await createBoardApi(name.trim(), workspacePath.trim() || undefined, environmentId || undefined, autoMode);
      if (!boardId) throw new Error('Failed to create board');

      await fetchBoard(boardId);
      const backlogCol = useKobaniStore.getState().columns.find(
        (c) => c.boardId === boardId && c.type === 'inactive'
      );
      if (!backlogCol) throw new Error('Backlog column not found');

      // Create cards sequentially to resolve dependsOn indices to real IDs
      const createdCardIds: string[] = [];
      for (const draft of drafts) {
        const dependsOn = (draft.dependsOnIndices ?? [])
          .filter((idx: number) => idx >= 0 && idx < createdCardIds.length)
          .map((idx: number) => createdCardIds[idx]);

        // Per-card env takes priority, then board-level, then nothing
        const cardEnvId = draft.environmentId || environmentId || undefined;
        const result = await createCardApi(boardId, {
          title: draft.title,
          columnId: backlogCol.id,
          description: draft.description,
          role: draft.role,
          acceptanceCriteria: draft.acceptanceCriteria.map((text, i) => ({
            id: `ac-${Date.now()}-${i}`,
            text,
            passed: null,
            evidence: null,
          })),
          ...(cardEnvId ? { environmentId: cardEnvId } : {}),
          ...(dependsOn.length > 0 ? { dependsOn } : {}),
        });
        createdCardIds.push((result as { id: string }).id);
      }

      onClose();
      router.push(`/boards/${boardId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(i: number, fields: Partial<CardDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...fields } : d)));
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">New Board</h2>
            {step === 'preview' && (
              <p className="text-xs text-zinc-500 mt-0.5">{drafts.length} cards generated — review before creating</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step: input */}
        {step === 'input' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Board name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Backend API v2"
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
              <p className="text-xs text-zinc-600">
                Creates with 6 default columns: Backlog · In Progress · Blocked · Review · Revision · Done
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Workspace path <span className="text-zinc-600 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="e.g. boards/my-project"
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors font-mono"
              />
              <p className="text-xs text-zinc-600">
                Folder path in the workspace repo. Auto-generated from name if left blank.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Environment <span className="text-zinc-600 font-normal normal-case">(optional)</span>
              </label>
              {envLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin shrink-0" />
                  <span className="text-sm text-zinc-500">Loading environments…</span>
                </div>
              ) : (
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none cursor-pointer"
                >
                  <option value="">— No environment —</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-zinc-600">
                Anthropic environment agents on this board will run in.
              </p>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Auto Mode</label>
                <p className="text-xs text-zinc-600">
                  Automatically start cards when their dependencies are resolved.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoMode}
                onClick={() => setAutoMode(!autoMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${autoMode ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${autoMode ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Spec <span className="text-zinc-600 font-normal normal-case">(optional)</span>
              </label>
              <p className="text-xs text-zinc-600">Paste a PRD or description and Claude will generate cards automatically.</p>
              <textarea
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="Paste your spec here…"
                rows={6}
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {spec.trim() ? 'Generating…' : 'Creating…'}
                  </>
                ) : spec.trim() ? (
                  'Generate Cards'
                ) : (
                  'Create Board'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step: preview */}
        {step === 'preview' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-3">
              {drafts.map((draft, i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={draft.title}
                      onChange={(e) => updateDraft(i, { title: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none border-b border-transparent focus:border-zinc-600 pb-0.5 transition-colors"
                    />
                    <select
                      value={draft.role}
                      onChange={(e) => updateDraft(i, { role: e.target.value })}
                      className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer outline-none"
                    >
                      {/* Include draft's role if not in the known list */}
                      {!roles.includes(draft.role) && (
                        <option key={draft.role} value={draft.role}>
                          {roleLabel(draft.role)}
                        </option>
                      )}
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeDraft(i)}
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs cursor-pointer shrink-0"
                      title="Remove card"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Env:</span>
                    {envLoading ? (
                      <span className="text-xs text-zinc-600">Loading...</span>
                    ) : environments.length === 0 ? (
                      <span className="text-xs text-zinc-600">{environmentId ? environments.find((e) => e.id === environmentId)?.name ?? 'Board default' : 'Default (from role)'}</span>
                    ) : (
                      <select
                        value={draft.environmentId ?? environmentId ?? ''}
                        onChange={(e) => updateDraft(i, { environmentId: e.target.value || null })}
                        className="text-xs bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 outline-none cursor-pointer"
                      >
                        <option value="">Default (from role)</option>
                        {environments.map((env) => (
                          <option key={env.id} value={env.id}>
                            {env.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {draft.dependsOnIndices && draft.dependsOnIndices.length > 0 && (
                    <p className="text-xs text-zinc-500">
                      Depends on: {draft.dependsOnIndices.map((idx: number) => drafts[idx]?.title ?? `#${idx}`).join(', ')}
                    </p>
                  )}
                  {draft.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{draft.description}</p>
                  )}
                  {draft.acceptanceCriteria.length > 0 && (
                    <ul className="flex flex-col gap-1 mt-1">
                      {draft.acceptanceCriteria.map((ac, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-xs text-zinc-500">
                          <span className="text-zinc-600 mt-0.5">·</span>
                          {ac}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {drafts.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-8">All cards removed. Go back to regenerate.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
              <button
                onClick={() => { setStep('input'); setError(null); }}
                className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors cursor-pointer"
              >
                ← Edit spec
              </button>
              <div className="flex flex-col items-end gap-2">
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={drafts.length === 0 || loading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating…
                      </>
                    ) : (
                      `Create Board (${drafts.length} cards)`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
