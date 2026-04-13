export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const BoardView = nextDynamic(() => import('./_components/BoardView'), { ssr: false });

interface Props {
  params: { id: string };
}

export default function BoardPage({ params }: Props) {
  return <BoardView boardId={params.id} />;
}
