'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AdminUserRow } from '@/lib/api-types';

export default function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;
    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername: inviteUsername.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite user');
      }
      setInviteUsername('');
      setInviting(false);
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleAdmin = async (user: AdminUserRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user');
      }
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    }
  };

  const deleteUser = async (user: AdminUserRow) => {
    if (!confirm(`Remove user @${user.githubUsername}?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    }
  };

  const filtered = users.filter((u) =>
    u.githubUsername.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading users...</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-72"
        />
        {inviting ? (
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              placeholder="GitHub username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              autoFocus
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
            />
            <button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteUsername.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {inviteLoading ? 'Inviting...' : 'Invite'}
            </button>
            <button
              onClick={() => { setInviting(false); setInviteUsername(''); }}
              className="text-zinc-400 hover:text-zinc-100 text-sm px-2 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setInviting(true)}
            className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Invite User
          </button>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Username</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Groups</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Added</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  {search ? 'No users match your search.' : 'No users yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-100">@{user.githubUsername}</span>
                    {user.isAdmin && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-amber-900 text-amber-400 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.groups.length > 0 ? (
                      user.groups.map((g) => (
                        <span key={g.id} className="inline-flex items-center bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md mr-1.5 mb-1">
                          {g.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-600 italic text-xs">No groups</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border-l-4 ${
                      user.isAdmin
                        ? 'bg-amber-900 text-amber-400 border-l-amber-500'
                        : 'bg-zinc-700 text-zinc-300 border-l-zinc-500'
                    }`}>
                      {user.isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAdmin(user)}
                        className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                        title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        {user.isAdmin ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
