'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useKobaniStore } from '@/lib/store';

interface Props {
  board: { id: string; name: string };
  onClose: () => void;
}

export default function DeleteBoardModal({ board, onClose }: Props) {
  const deleteBoardApi = useKobaniStore((s) => s.deleteBoardApi);
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const confirmed = confirmation === board.name;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed || loading) return;
    setLoading(true);
    const ok = await deleteBoardApi(board.id);
    if (ok) {
      router.push('/');
    } else {
      setLoading(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        data-testid="delete-board-modal"
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Delete board</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
          <p className="text-sm text-zinc-400">
            This will permanently delete{' '}
            <span className="font-semibold text-zinc-100">{board.name}</span> and all its
            columns and cards. This cannot be undone.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Type <span className="text-zinc-200 font-mono">{board.name}</span> to confirm
            </label>
            <input
              type="text"
              autoFocus
              data-testid="delete-board-name-input"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={board.name}
              className="bg-zinc-950 border border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="delete-board-confirm"
              disabled={!confirmed || loading}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
            >
              {loading ? 'Deleting…' : 'Delete board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
