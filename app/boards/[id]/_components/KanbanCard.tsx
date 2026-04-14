'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useKobaniStore } from '@/lib/store';
import type { Card } from '@/lib/kanban-types';
import AgentStatusBadge from '@/app/_components/AgentStatusBadge';
import { relativeTime } from '@/lib/timeUtils';

interface Props {
  card: Card;
  isDragging?: boolean;
}

function getInitials(name: string): string {
  const parts = name.replace('@', '').split(/[\s.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.replace('@', '').slice(0, 2).toUpperCase();
}

export default function KanbanCard({ card, isDragging: overrideDragging }: Props) {
  const openCardDetail = useKobaniStore((s) => s.openCardDetail);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableDragging,
  } = useSortable({ id: card.id, disabled: !card.canInteract });

  const isDragging = overrideDragging || sortableDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (sortableDragging && !overrideDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-zinc-800/30 border border-dashed border-zinc-700 rounded-lg p-3 opacity-50 min-h-[72px]"
      />
    );
  }

  const initials = getInitials(card.assignee);
  const timeInCol = relativeTime(card.movedToColumnAt);
  const currentRun = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
  const attempt = currentRun?.attempt ?? null;

  return (
    <div
      ref={overrideDragging ? undefined : setNodeRef}
      style={overrideDragging ? undefined : style}
      {...(overrideDragging ? {} : attributes)}
      {...(overrideDragging ? {} : listeners)}
      data-testid="kanban-card"
      data-card-id={card.id}
      onClick={() => {
        if (!isDragging) openCardDetail(card.id);
      }}
      title={!card.canInteract ? 'No access to this agent/environment' : undefined}
      className={`bg-zinc-800 border rounded-lg p-3 cursor-pointer shadow-sm transition-all duration-150 select-none flex flex-col gap-2 ${
        !card.canInteract
          ? 'opacity-50 cursor-default border-zinc-700'
          : isDragging
            ? 'border-indigo-500 bg-zinc-700 shadow-2xl opacity-80 rotate-1 scale-105 cursor-grabbing z-50'
            : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-700 hover:shadow-md'
      }`}
    >
      {/* Title */}
      <p data-testid="kanban-card-title" className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 overflow-hidden">
        {card.title}
      </p>

      {/* Status badge */}
      <AgentStatusBadge
        status={card.agentStatus}
        retryAfterMs={
          card.agentStatus === 'failed' ? currentRun?.retryAfterMs : undefined
        }
      />

      {/* Footer: assignee + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {card.assignee && (
            <>
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initials}
              </div>
              <span className="text-xs text-zinc-500">{card.assignee}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {attempt !== null && (
            <span className="text-zinc-600">{attempt}/{card.maxAttempts ?? 5}</span>
          )}
          {timeInCol && <span>{timeInCol}</span>}
        </div>
      </div>
    </div>
  );
}
