'use client';

import Link from 'next/link';
import { useKobaniStore } from '@/lib/store';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

interface Props {
  boardId?: string;
  showAttentionBreadcrumb?: boolean;
}

export default function TopNav({ boardId, showAttentionBreadcrumb }: Props) {
  const boards = useKobaniStore((s) => s.boards);
  const board = boardId ? boards.find((b) => b.id === boardId) : null;

  return (
    <nav className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center flex-1 gap-0.5 min-w-0">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-100 tracking-tight hover:text-white transition-colors shrink-0"
        >
          Kobani
        </Link>
        {board && (
          <>
            <span className="text-zinc-600 mx-1 shrink-0">/</span>
            <span className="text-base font-medium text-zinc-400 truncate max-w-[140px] md:max-w-xs">
              {board.name}
            </span>
          </>
        )}
        {showAttentionBreadcrumb && !board && (
          <>
            <span className="text-zinc-600 mx-1 shrink-0">/</span>
            <span className="text-base font-medium text-zinc-400">Attention</span>
          </>
        )}
      </div>

      {/* Right: bell + avatar + overflow */}
      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell />
        <UserMenu />
        <button className="text-zinc-400 hover:text-zinc-100 cursor-pointer px-1 transition-colors">
          ···
        </button>
      </div>
    </nav>
  );
}
