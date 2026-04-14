'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AdminGroupRow, AdminUserRow } from '@/lib/api-types';

function MemberSearch({
  nonMembers,
  onAdd,
}: {
  nonMembers: AdminUserRow[];
  onAdd: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = query.trim()
    ? nonMembers.filter((u) =>
        u.githubUsername.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div>
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Add Member
      </div>
      <input
        type="text"
        placeholder="Search by username…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {matches.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {matches.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-1 px-1 rounded hover:bg-zinc-800/50">
              <span className="font-mono text-xs text-zinc-300">@{u.githubUsername}</span>
              <button
                onClick={() => { onAdd(u.id); setQuery(''); }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="text-[10px] text-zinc-600 mt-1.5">No matching users found</p>
      )}
    </div>
  );
}

export default function GroupsTab() {
  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AdminGroupRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRoles, setNewRoles] = useState('');
  const [newEnvs, setNewEnvs] = useState('');

  const fetchGroups = useCallback(async () => {
    try {
      const [groupsRes, usersRes] = await Promise.all([
        fetch('/api/admin/groups'),
        fetch('/api/admin/users'),
      ]);
      if (!groupsRes.ok) throw new Error('Failed to fetch groups');
      if (!usersRes.ok) throw new Error('Failed to fetch users');
      setGroups(await groupsRes.json());
      setUsers(await usersRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreateLoading(true);
    setError(null);
    try {
      const agentRoles = newRoles.split(',').map(r => r.trim()).filter(Boolean);
      const environmentIds = newEnvs.split(',').map(e => e.trim()).filter(Boolean);

      if (agentRoles.length === 0) {
        setError('At least one agent role is required (comma-separated, or * for all)');
        setCreateLoading(false);
        return;
      }
      if (environmentIds.length === 0) {
        setError('At least one environment ID is required (comma-separated, or * for all)');
        setCreateLoading(false);
        return;
      }

      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          agentRoles,
          environmentIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }
      setNewName('');
      setNewDesc('');
      setNewRoles('');
      setNewEnvs('');
      setCreating(false);
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create group');
    } finally {
      setCreateLoading(false);
    }
  };

  const deleteGroup = async (group: AdminGroupRow) => {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${group.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete group');
      }
      if (selectedGroup?.id === group.id) setSelectedGroup(null);
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete group');
    }
  };

  const addMember = async (groupId: string, userId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add member');
      }
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member');
    }
  };

  const removeMember = async (groupId: string, userId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  };

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading groups...</p>;
  }

  // Users that are members of the selected group
  const groupMembers = selectedGroup
    ? users.filter((u) => u.groups.some((g) => g.id === selectedGroup.id))
    : [];
  const nonMembers = selectedGroup
    ? users.filter((u) => !u.groups.some((g) => g.id === selectedGroup.id))
    : [];

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
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-72"
        />
        <button
          onClick={() => setCreating(!creating)}
          className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {creating ? 'Cancel' : 'Create Group'}
        </button>
      </div>

      {creating && (
        <div className="mb-6 rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
          <input
            type="text"
            placeholder="Group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Agent roles (comma-separated, e.g. backend-engineer,qa-engineer or * for all)"
            value={newRoles}
            onChange={(e) => setNewRoles(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Environment IDs (comma-separated, or * for all)"
            value={newEnvs}
            onChange={(e) => setNewEnvs(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={createLoading || !newName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Groups list */}
        <div className="flex-1 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Group</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Members</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Agents</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Environments</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    {search ? 'No groups match your search.' : 'No groups yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                      selectedGroup?.id === group.id ? 'bg-zinc-800/70' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{group.name}</div>
                      {group.description && (
                        <div className="text-xs text-zinc-500 mt-0.5">{group.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{group.memberCount}</td>
                    <td className="px-4 py-3">
                      {group.agentRoles.map((r) => (
                        <span key={r} className="inline-flex items-center bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md mr-1 mb-1">
                          {r === '*' ? 'All agents' : r}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      {group.environments.map((e) => (
                        <span key={e} className="inline-flex items-center bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md mr-1 mb-1">
                          {e === '*' ? 'All envs' : e}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteGroup(group); }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Group detail panel */}
        {selectedGroup && (
          <div className="w-80 rounded-xl bg-zinc-900 border border-zinc-800 p-4 self-start">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">{selectedGroup.name}</h3>
            {selectedGroup.description && (
              <p className="text-xs text-zinc-500 mb-3">{selectedGroup.description}</p>
            )}

            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Members ({groupMembers.length})
            </div>
            <div className="space-y-1 mb-4">
              {groupMembers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-1">
                  <span className="font-mono text-xs text-zinc-300">@{u.githubUsername}</span>
                  <button
                    onClick={() => removeMember(selectedGroup.id, u.id)}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {groupMembers.length === 0 && (
                <p className="text-xs text-zinc-600 italic">No members</p>
              )}
            </div>

            <MemberSearch
              nonMembers={nonMembers}
              onAdd={(userId) => addMember(selectedGroup.id, userId)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
