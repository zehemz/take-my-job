'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useKobaniStore } from '@/lib/store';
import type { AgentRole } from '@/lib/kanban-types';

const ROLES: AgentRole[] = [
  'backend-engineer',
  'qa-engineer',
  'tech-lead',
  'content-writer',
  'product-spec-writer',
  'designer',
];

interface Props {
  columnId: string;
  boardId: string;
  onClose: () => void;
}

export default function NewCardModal({ columnId, boardId, onClose }: Props) {
  const createCardApi = useKobaniStore((s) => s.createCardApi);
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);

  const [title, setTitle] = useState('');
  const [role, setRole] = useState<AgentRole>('backend-engineer');
  const [description, setDescription] = useState('');
  const [criteriaText, setCriteriaText] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

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
      role,
      description: description.trim(),
      acceptanceCriteria: criteria,
      githubRepo: githubRepo.trim() || undefined,
      githubBranch: githubBranch.trim() || undefined,
    });

    if (result) {
      await fetchBoard(boardId);
    }

    onClose();
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title..."
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Agent Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AgentRole)}
              className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                GitHub Repo
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="org/repo"
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Branch
              </label>
              <input
                type="text"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                placeholder="feat/my-branch"
                className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              Create Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
