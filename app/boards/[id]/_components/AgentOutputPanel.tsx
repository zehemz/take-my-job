'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  output: string;
  isLive: boolean;
}

export default function AgentOutputPanel({ output, isLive }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (!userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (!isLive) {
      userScrolledRef.current = false;
    }
  }, [isLive]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    userScrolledRef.current = !atBottom;
  }

  if (!output) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-center max-h-64">
        <span className="text-xs text-zinc-600">Waiting for agent output...</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-y-auto max-h-64 p-3"
    >
      <pre className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-words m-0">
        {output}
        {isLive && <span className="animate-pulse text-indigo-400">▌</span>}
      </pre>
    </div>
  );
}
