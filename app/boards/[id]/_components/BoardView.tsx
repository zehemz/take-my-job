'use client';

import { useEffect } from 'react';
import { useKobaniStore } from '@/lib/store';
import TopNav from '@/app/_components/TopNav';
import KanbanBoard from './KanbanBoard';
import CardDetailModal from './CardDetailModal';

interface Props {
  boardId: string;
}

export default function BoardView({ boardId }: Props) {
  const boards = useKobaniStore((s) => s.boards);
  const selectedCardId = useKobaniStore((s) => s.selectedCardId);
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);

  useEffect(() => {
    fetchBoard(boardId);
  }, [boardId, fetchBoard]);

  const board = boards.find((b) => b.id === boardId);

  if (!board) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopNav boardId={boardId} />
        <div className="flex items-center justify-center flex-1">
          <p className="text-zinc-500 text-sm">Board not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav boardId={boardId} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 shrink-0 flex items-center justify-between">
          <h1 className="text-base font-medium text-zinc-200">{board.name}</h1>
          <button className="text-zinc-400 hover:text-zinc-100 cursor-pointer px-1 transition-colors text-sm">
            ···
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <KanbanBoard boardId={boardId} />
        </div>
      </div>
      {selectedCardId && <CardDetailModal />}
    </div>
  );
}
