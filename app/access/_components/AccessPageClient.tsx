'use client';

import { useState } from 'react';
import TopNav from '@/app/_components/TopNav';
import UsersTab from './UsersTab';
import GroupsTab from './GroupsTab';

type Tab = 'users' | 'groups';

export default function AccessPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <h1 className="text-xl font-semibold text-zinc-100">Access Control</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage users, groups, and permissions.
        </p>

        <div className="flex gap-0 border-b border-zinc-800 mt-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'text-zinc-100 font-medium border-indigo-500'
                : 'text-zinc-400 hover:text-zinc-100 border-transparent cursor-pointer'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 text-sm transition-colors border-b-2 ${
              activeTab === 'groups'
                ? 'text-zinc-100 font-medium border-indigo-500'
                : 'text-zinc-400 hover:text-zinc-100 border-transparent cursor-pointer'
            }`}
          >
            Groups
          </button>
        </div>

        <div className="mt-6">
          {activeTab === 'users' ? <UsersTab /> : <GroupsTab />}
        </div>
      </div>
    </div>
  );
}
