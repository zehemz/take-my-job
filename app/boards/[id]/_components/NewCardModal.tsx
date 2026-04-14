'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useKobaniStore } from '@/lib/store';
import { useRoles, roleLabel } from '@/lib/useRoles';

interface Props {
  columnId: string;
  boardId: string;
  onClose: () => void;
}

export default function NewCardModal({ columnId, boardId, onClose }: Props) {
  const createCardApi = useKobaniStore((s) => s.createCardApi);
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);
  const { roles } = useRoles();

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [criteriaText, setCriteriaText] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selectedRole = role || roles[0];
    if (!title.trim() || !selectedRole || loading) return;

    setLoading(true);
    try {
      const criteria = criteriaText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, i) => ({
          id: `ac-new-${Date.now()}-${i}`,
          text,
          passed: null as null,
          evidence: null as null,
        }));

      const result = await createCardApi(boardId, {
        title: title.trim(),
        columnId,
        role: selectedRole,
        description: description.trim(),
        acceptanceCriteria: criteria,
        requiresApproval,
      });

      if (result) {
        await fetchBoard(boardId);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        data-testid="new-card-modal"
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">New Card</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              data-testid="new-card-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title..."
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Agent Role <span className="text-red-400">*</span>
            </label>
            <select
              value={role || roles[0] || ''}
              onChange={(e) => setRole(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none cursor-pointer"
            >
              {roles.length === 0 && (
                <option value="">No agents configured</option>
              )}
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should the agent do?"
              rows={3}
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Acceptance Criteria
            </label>
            <p className="text-xs text-zinc-600">One criterion per line</p>
            <textarea
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              placeholder="Each line becomes one acceptance criterion..."
              rows={4}
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5 py-3 border-t border-zinc-800">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded border border-zinc-600 bg-zinc-950 accent-indigo-600 cursor-pointer shrink-0"
              />
              <span className="text-sm text-zinc-200 font-medium">
                Requires human approval before closing
              </span>
            </label>
            <p className="text-xs text-zinc-500 ml-[26px]">
              {requiresApproval
                ? 'Agent output will go to review before this card can be closed.'
                : 'This card will close automatically when all criteria pass.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="new-card-submit"
              disabled={loading || roles.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
