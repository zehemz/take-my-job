'use client';

import React, { useState } from 'react';
import { useKobaniStore } from '@/lib/store';
import type { Card, Column, Board } from '@/lib/kanban-types';
import AgentStatusBadge from '@/app/_components/AgentStatusBadge';
import CardDetailModal from '@/app/boards/[id]/_components/CardDetailModal';
import TopNav from '@/app/_components/TopNav';
import { relativeTime, isOlderThan } from '@/lib/timeUtils';

const ONE_HOUR_MS = 60 * 60 * 1000;

interface AttentionItem {
  card: Card;
  column: Column;
  board: Board;
  isUrgent: boolean;
  summary: string;
}

function getItemSummary(card: Card): string {
  const currentRun = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
  if (card.agentStatus === 'blocked' && currentRun?.blockedReason) {
    const text = currentRun.blockedReason;
    return text.slice(0, 120) + (text.length > 120 ? '...' : '');
  }
  if (card.agentStatus === 'evaluation-failed') {
    const failedCount = card.acceptanceCriteria.filter((c) => c.passed === false).length;
    return `${failedCount} criterion${failedCount !== 1 ? 'a' : ''} failed evaluation.`;
  }
  if (card.agentStatus === 'pending-approval') {
    return 'All criteria passed. Awaiting human approval.';
  }
  return '';
}

function AttentionItemCard({
  item,
  onOpenCard,
}: {
  item: AttentionItem;
  onOpenCard: (cardId: string) => void;
}) {
  const approveCard = useKobaniStore((s) => s.approveCard);
  const requestRevision = useKobaniStore((s) => s.requestRevision);
  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const currentRun = item.card.agentRuns.find((r) => r.id === item.card.currentAgentRunId);
  const age = relativeTime(currentRun?.startedAt ?? item.card.updatedAt);

  const borderClass =
    item.card.agentStatus === 'blocked'
      ? item.isUrgent
        ? 'border-red-500'
        : 'border-amber-800'
      : item.card.agentStatus === 'evaluation-failed'
      ? 'border-rose-800'
      : 'border-violet-800';

  const bgClass =
    item.card.agentStatus === 'blocked' && item.isUrgent ? 'bg-red-950' : 'bg-zinc-800';

  function handleApprove() {
    approveCard(item.card.id);
  }

  function handleRequestRevision() {
    if (showRevision && revisionNote.trim()) {
      requestRevision(item.card.id, revisionNote);
      setShowRevision(false);
    } else {
      setShowRevision(true);
    }
  }

  return (
    <div className={`${bgClass} border ${borderClass} rounded-lg p-4 flex flex-col gap-3`}>
      {/* Header: badge + urgency + age */}
      <div className="flex items-center justify-between">
        <AgentStatusBadge status={item.card.agentStatus} />
        <div className="flex items-center gap-2">
          {item.isUrgent && (
            <span className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-1.5 py-0.5">
              URGENT
            </span>
          )}
          <span className="text-xs text-zinc-500">{age} ago</span>
        </div>
      </div>

      {/* Title + board path */}
      <div>
        <p
          className="text-sm font-medium text-zinc-100 cursor-pointer hover:text-indigo-300 transition-colors"
          onClick={() => onOpenCard(item.card.id)}
        >
          {item.card.title}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {item.board.name} / {item.column.name}
        </p>
      </div>

      {/* Summary */}
      {item.summary && (
        <p className="text-sm text-zinc-400 leading-relaxed">{item.summary}</p>
      )}

      {/* Revision form */}
      {showRevision && (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
            rows={2}
            placeholder="Describe what needs revision..."
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 justify-end">
        {item.card.agentStatus === 'blocked' && (
          <>
            <button
              onClick={() => onOpenCard(item.card.id)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              Reply
            </button>
            <button
              onClick={() => onOpenCard(item.card.id)}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              Connect via CLI
            </button>
          </>
        )}
        {item.card.agentStatus === 'evaluation-failed' && (
          <button
            onClick={() => onOpenCard(item.card.id)}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
          >
            View evaluation report
          </button>
        )}
        {item.card.agentStatus === 'pending-approval' && (
          <>
            <button
              onClick={handleRequestRevision}
              className="border border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              ✗ Request Revision
            </button>
            <button
              onClick={handleApprove}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
            >
              ✓ Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const GROUPS: Array<{
  key: 'blocked' | 'evaluation-failed' | 'pending-approval';
  label: string;
}> = [
  { key: 'blocked', label: 'Blocked' },
  { key: 'evaluation-failed', label: 'Revision Needed' },
  { key: 'pending-approval', label: 'Pending Approval' },
];

export default function AttentionQueueClient() {
  const cards = useKobaniStore((s) => s.cards);
  const columns = useKobaniStore((s) => s.columns);
  const boards = useKobaniStore((s) => s.boards);
  const openCardDetail = useKobaniStore((s) => s.openCardDetail);
  const selectedCardId = useKobaniStore((s) => s.selectedCardId);

  const attentionCards = cards.filter(
    (c) =>
      c.agentStatus === 'blocked' ||
      c.agentStatus === 'evaluation-failed' ||
      c.agentStatus === 'pending-approval'
  );

  function buildItem(card: Card): AttentionItem | null {
    const column = columns.find((col) => col.id === card.columnId);
    const board = boards.find((b) => b.id === card.boardId);
    if (!column || !board) return null;

    const currentRun = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
    const isUrgent =
      card.agentStatus === 'blocked'
        ? isOlderThan(currentRun?.startedAt ?? card.updatedAt, ONE_HOUR_MS)
        : false;

    return {
      card,
      column,
      board,
      isUrgent,
      summary: getItemSummary(card),
    };
  }

  const items = attentionCards
    .map(buildItem)
    .filter((i): i is AttentionItem => i !== null);

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav showAttentionBreadcrumb />
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-zinc-100">Needs Attention</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>

          {items.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-zinc-600">Nothing needs your attention right now.</p>
            </div>
          )}

          <div className="flex flex-col gap-8">
            {GROUPS.map(({ key, label }) => {
              const groupItems = items.filter((i) => i.card.agentStatus === key);
              if (groupItems.length === 0) return null;

              return (
                <div key={key} className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
                    {label} — {groupItems.length}
                  </p>
                  <div className="flex flex-col gap-3">
                    {groupItems.map((item) => (
                      <AttentionItemCard
                        key={item.card.id}
                        item={item}
                        onOpenCard={openCardDetail}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedCardId && <CardDetailModal />}
    </div>
  );
}
