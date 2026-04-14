export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/db';
import { mapAgentConfig } from '@/lib/api-mappers';
import TopNav from '@/app/_components/TopNav';
import AgentConfigTable from './_components/AgentConfigTable';

export default async function AgentsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const rows = await prisma.agentConfig.findMany({ orderBy: { createdAt: 'asc' } });
  const items = rows.map(mapAgentConfig);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <TopNav />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">Managed agent configurations</p>
        </div>
        <AgentConfigTable items={items} />
      </div>
    </div>
  );
}
