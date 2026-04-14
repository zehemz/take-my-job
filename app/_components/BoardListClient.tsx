'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useKobaniStore } from '@/lib/store';
import TopNav from './TopNav';
import NewBoardModal from './NewBoardModal';

export default function BoardListClient() {
  const boards = useKobaniStore((s) => s.boards);
  const columns = useKobaniStore((s) => s.columns);
  const cards = useKobaniStore((s) => s.cards);
  const fetchBoards = useKobaniStore((s) => s.fetchBoards);
  const [showNewBoard, setShowNewBoard] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">All Boards</h1>
            <p className="text-sm text-zinc-500 mt-1">{boards.length} boards</p>
          </div>
          <button
            onClick={() => setShowNewBoard(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            + New Board
          </button>
        </div>

        <div data-testid="board-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => {
            const boardColumns = columns.filter((c) => c.boardId === board.id);
            const boardCards = cards.filter((c) => c.boardId === board.id);
            const createdDate = new Date(board.createdAt).toLocaleDateString();

            return (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                data-testid="board-card"
                className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-5 flex flex-col gap-3 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                    {board.name}
                  </h2>
                  <span className="text-zinc-600 text-lg">›</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{boardColumns.length} columns</span>
                  <span>{boardCards.length} cards</span>
                </div>
                <div className="text-xs text-zinc-600">Created {createdDate}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} />}
    </div>
  );
}
