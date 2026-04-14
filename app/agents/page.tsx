export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { devAuth as auth } from '@/lib/dev-auth';
import { listAgents } from '@/lib/agents-service';
import TopNav from '@/app/_components/TopNav';
import AgentConfigTable from './_components/AgentConfigTable';
import type { AgentRow } from '@/lib/api-types';

export default async function AgentsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  let items: AgentRow[];
  let error: string | null = null;
  try {
    items = await listAgents();
  } catch {
    error = 'Failed to load agents from Anthropic.';
    items = [];
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">Live data from Anthropic · role mapping from local DB</p>
        </div>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <AgentConfigTable items={items} />
        )}
      </div>
    </div>
  );
}
