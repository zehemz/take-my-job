export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const AttentionQueueClient = nextDynamic(
  () => import('./_components/AttentionQueueClient'),
  { ssr: false }
);

export default function AttentionPage() {
  return <AttentionQueueClient />;
}
