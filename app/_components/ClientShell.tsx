'use client';

import nextDynamic from 'next/dynamic';

const TopNav = nextDynamic(() => import('./TopNav'), { ssr: false });

interface Props {
  children: React.ReactNode;
}

export default function ClientShell({ children }: Props) {
  return (
    <>
      <TopNav />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </>
  );
}
