'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center flex-1 gap-0.5 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-zinc-100 tracking-tight hover:text-white transition-colors shrink-0"
        >
          <Image src="/logo.png" alt="Kobani" width={26} height={28} className="shrink-0" />
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
        <span className="text-zinc-700 mx-2 shrink-0">|</span>
        <Link
          href="/"
          className={`shrink-0 text-sm transition-colors ${
            pathname === '/'
              ? 'text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Boards
        </Link>
        <span className="text-zinc-700 mx-1 shrink-0">·</span>
        <Link
          href="/agents"
          className={`shrink-0 text-sm transition-colors ${
            pathname.startsWith('/agents')
              ? 'text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Agents
        </Link>
        <span className="text-zinc-700 mx-1 shrink-0">·</span>
        <Link
          href="/sessions"
          className={`shrink-0 text-sm transition-colors ${
            pathname.startsWith('/sessions')
              ? 'text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Sessions
        </Link>
        <span className="text-zinc-700 mx-1 shrink-0">·</span>
        <Link
          href="/environments"
          className={`shrink-0 text-sm transition-colors ${
            pathname.startsWith('/environments')
              ? 'text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Environments
        </Link>
        {session?.user?.isAdmin && (
          <>
            <span className="text-zinc-700 mx-1 shrink-0">·</span>
            <Link
              href="/access"
              className={`shrink-0 text-sm transition-colors ${
                pathname.startsWith('/access')
                  ? 'text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Access
            </Link>
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
