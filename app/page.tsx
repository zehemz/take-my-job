export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const BoardListClient = nextDynamic(() => import('./_components/BoardListClient'), { ssr: false });

export default function HomePage() {
  return <BoardListClient />;
}
