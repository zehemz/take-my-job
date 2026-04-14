'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useKobaniStore } from '@/lib/store';
import type { AgentRole } from '@/lib/kanban-types';
import type { CardDraft } from '@/app/api/projects/parse/route';

const AGENT_ROLES: AgentRole[] = [
  'backend-engineer',
  'qa-engineer',
  'tech-lead',
  'content-writer',
  'product-spec-writer',
  'designer',
];

const ROLE_LABELS: Record<AgentRole, string> = {
  'backend-engineer': 'Backend',
  'qa-engineer': 'QA',
  'tech-lead': 'Tech Lead',
  'content-writer': 'Content',
  'product-spec-writer': 'Spec Writer',
  'designer': 'Designer',
};

const ROLE_COLORS: Record<AgentRole, string> = {
  'backend-engineer': 'bg-blue-900/50 text-blue-300 border-blue-700',
  'qa-engineer': 'bg-green-900/50 text-green-300 border-green-700',
  'tech-lead': 'bg-purple-900/50 text-purple-300 border-purple-700',
  'content-writer': 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  'product-spec-writer': 'bg-orange-900/50 text-orange-300 border-orange-700',
  'designer': 'bg-pink-900/50 text-pink-300 border-pink-700',
};

interface Props {
  onClose: () => void;
}

type Step = 'input' | 'preview';

export default function NewProjectModal({ onClose }: Props) {
  const router = useRouter();
  const createBoardApi = useKobaniStore((s) => s.createBoardApi);
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);
  const createCardApi = useKobaniStore((s) => s.createCardApi);

  const [step, setStep] = useState<Step>('input');
  const [projectName, setProjectName] = useState('');
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CardDraft[]>([]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || !spec.trim()) return;
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
      // Create board via API (also creates default columns server-side)
      const boardId = await createBoardApi(projectName.trim());
      if (!boardId) throw new Error('Failed to create board');

      // Fetch board to get column IDs
      await fetchBoard(boardId);
      const backlogCol = useKobaniStore.getState().columns.find(
        (c) => c.boardId === boardId && c.type === 'inactive'
      );
      if (!backlogCol) throw new Error('Backlog column not found');

      // Create all cards in Backlog
      await Promise.all(
        drafts.map((draft) =>
          createCardApi(boardId, {
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
          })
        )
      );

      onClose();
      router.push(`/boards/${boardId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateDraft(i: number, fields: Partial<CardDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...fields } : d)));
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">New Project</h2>
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
          <form onSubmit={handleGenerate} className="flex flex-col gap-4 px-6 py-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Auth Refactor Q2"
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Spec / PRD <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-zinc-600">Paste your spec, PRD, or a description of what needs to be built.</p>
              <textarea
                required
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="Paste your spec here..."
                rows={12}
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !projectName.trim() || !spec.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate Cards'
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
                <div
                  key={i}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={draft.title}
                      onChange={(e) => updateDraft(i, { title: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none border-b border-transparent focus:border-zinc-600 pb-0.5 transition-colors"
                    />
                    <select
                      value={draft.role}
                      onChange={(e) => updateDraft(i, { role: e.target.value as AgentRole })}
                      className={`text-xs font-medium px-2 py-0.5 rounded border bg-transparent cursor-pointer outline-none ${ROLE_COLORS[draft.role]}`}
                    >
                      {AGENT_ROLES.map((r) => (
                        <option key={r} value={r} className="bg-zinc-900 text-zinc-100">
                          {ROLE_LABELS[r]}
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
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
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
                      `Create Project (${drafts.length} cards)`
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
