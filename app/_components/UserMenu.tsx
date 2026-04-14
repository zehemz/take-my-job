'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const githubUsername = session?.user?.githubUsername ?? '';
  const avatarUrl = session?.user?.avatarUrl ?? '';
  const initials = githubUsername.slice(0, 2).toUpperCase() || 'LB';

  return (
    <div ref={containerRef} className="relative">
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
        aria-label="User menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-7 h-7 rounded-full object-cover cursor-pointer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white cursor-pointer select-none">
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1">
          {/* Username header */}
          <div className="px-3 py-2 text-xs text-zinc-500 font-mono">
            @{githubUsername}
          </div>

          {/* Divider */}
          <hr className="border-t border-zinc-800 my-1" />

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
