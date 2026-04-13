'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useKobaniStore } from '@/lib/store';
import type { AgentRun } from '@/lib/kanban-types';
import AgentStatusBadge from '@/app/_components/AgentStatusBadge';
import AcceptanceCriteriaList from './AcceptanceCriteriaList';
import AgentOutputPanel from './AgentOutputPanel';
import { relativeTime } from '@/lib/timeUtils';

function BlockedBanner({ cardId, blockedReason }: { cardId: string; blockedReason: string }) {
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const updateCard = useKobaniStore((s) => s.updateCard);

  const sessionId = `session-${cardId}`;
  const cliCommand = `ant sessions connect ${sessionId}`;

  function handleSendReply() {
    if (!reply.trim()) return;
    updateCard(cardId, { revisionContextNote: reply });
    setReply('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(cliCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-6 my-4 bg-amber-950 border border-amber-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-sm">⚠</span>
        <span className="text-sm font-semibold text-amber-200">Agent needs your input</span>
      </div>
      <p className="text-sm text-amber-200 leading-relaxed">{blockedReason}</p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Option A — Reply here</p>
        <textarea
          className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
          rows={3}
          placeholder="Reply to the agent..."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <button
          onClick={handleSendReply}
          className="self-end bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
        >
          Send to agent
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Option B — Connect via CLI</p>
        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
          <code className="flex-1 text-xs font-mono text-zinc-300">{cliCommand}</code>
          <button
            onClick={handleCopy}
            className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors cursor-pointer shrink-0"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RevisionContextForm({ cardId }: { cardId: string }) {
  const [note, setNote] = useState('');
  const sendRevisionContext = useKobaniStore((s) => s.sendRevisionContext);

  function handleSend() {
    sendRevisionContext(cardId, note);
  }

  return (
    <div className="px-6 py-4 border-t border-zinc-800 flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Revision Context (Optional)</p>
      <textarea
        className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
        rows={3}
        placeholder="Add context for the next attempt..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer"
        >
          Send back to In Progress
        </button>
      </div>
    </div>
  );
}

function PendingApprovalActions({ cardId }: { cardId: string }) {
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const approveCard = useKobaniStore((s) => s.approveCard);
  const requestRevision = useKobaniStore((s) => s.requestRevision);
  const closeCardDetail = useKobaniStore((s) => s.closeCardDetail);

  function handleApprove() {
    approveCard(cardId);
    closeCardDetail();
  }

  function handleRequestRevision() {
    if (showRevisionForm && revisionNote.trim()) {
      requestRevision(cardId, revisionNote);
      closeCardDetail();
    } else {
      setShowRevisionForm(true);
    }
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-3 shrink-0 border-t border-zinc-800">
      {showRevisionForm && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Revision reason</p>
          <textarea
            className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
            rows={2}
            placeholder="Describe what needs revision..."
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
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
          ✓ Approve &amp; Close
        </button>
      </div>
    </div>
  );
}

function RetrySchedulePanel({ agentRuns }: { agentRuns: AgentRun[] }) {
  const sorted = [...agentRuns].sort((a, b) => a.attempt - b.attempt);
  const lastRun = sorted[sorted.length - 1];

  return (
    <div className="px-6 py-4 border-t border-zinc-800 flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Retry Schedule</p>
      <div className="flex flex-col gap-2">
        {sorted.map((run) => (
          <div key={run.id} className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Attempt {run.attempt}</span>
            <span className={run.status === 'failed' ? 'text-red-400' : 'text-zinc-500'}>
              {run.status}
            </span>
            <span className="text-zinc-600">
              {run.endedAt ? relativeTime(run.endedAt) + ' ago' : 'ongoing'}
            </span>
          </div>
        ))}
      </div>
      {lastRun?.retryAfterMs != null && (
        <p className="text-xs text-zinc-500">
          Next retry in{' '}
          <span className="text-zinc-300 font-mono">{Math.ceil(lastRun.retryAfterMs / 1000)}s</span>
        </p>
      )}
    </div>
  );
}

export default function CardDetailModal() {
  const selectedCardId = useKobaniStore((s) => s.selectedCardId);
  const closeCardDetail = useKobaniStore((s) => s.closeCardDetail);
  const cards = useKobaniStore((s) => s.cards);
  const columns = useKobaniStore((s) => s.columns);

  const card = cards.find((c) => c.id === selectedCardId);
  const column = card ? columns.find((col) => col.id === card.columnId) : null;

  useEffect(() => {
    if (card) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [card]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCardDetail();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeCardDetail]);

  if (!card || !column) return null;

  const currentRun = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
  const isLive = card.agentStatus === 'running' || card.agentStatus === 'evaluating';
  const blockedRun = card.agentRuns.find((r) => r.status === 'blocked');
  const isInRevisionColumn = column.type === 'revision';

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={closeCardDetail}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full mx-3 max-h-[95vh] md:max-w-2xl md:mx-auto md:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 shrink-0">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-zinc-100">{card.title}</h2>
            <div className="flex items-center gap-2">
              <AgentStatusBadge
                status={card.agentStatus}
                retryAfterMs={currentRun?.retryAfterMs}
              />
              <span className="text-xs text-zinc-500">
                {relativeTime(card.movedToColumnAt)} in {column.name}
              </span>
            </div>
          </div>
          <button
            onClick={closeCardDetail}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Meta row */}
        {currentRun && (
          <div className="px-6 py-3 flex items-center gap-4 text-xs text-zinc-500 shrink-0 border-t border-zinc-800">
            <span>
              Role: <span className="text-zinc-300">{currentRun.role}</span>
            </span>
            <span>
              Attempt: <span className="text-zinc-300">{currentRun.attempt} / 5</span>
            </span>
            <span>
              Started: <span className="text-zinc-300">{relativeTime(currentRun.startedAt)} ago</span>
            </span>
          </div>
        )}

        {/* Description */}
        {card.description && (
          <div className="px-6 py-3 border-t border-zinc-800">
            <p className="text-sm text-zinc-300 leading-relaxed">{card.description}</p>
          </div>
        )}

        {/* Blocked banner */}
        {card.agentStatus === 'blocked' && blockedRun?.blockedReason && (
          <BlockedBanner cardId={card.id} blockedReason={blockedRun.blockedReason} />
        )}

        {/* Acceptance Criteria */}
        <div className="px-6 py-4 border-t border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Acceptance Criteria
          </p>
          <AcceptanceCriteriaList
            criteria={card.acceptanceCriteria}
            cardStatus={card.agentStatus}
          />
        </div>

        {/* Agent Output */}
        <div className="px-6 py-4 flex-1 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Agent Output
            </p>
            {isLive && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            )}
          </div>
          {currentRun ? (
            <>
              <AgentOutputPanel output={currentRun.output} isLive={isLive} />
              {/* Previous runs */}
              {card.agentRuns.length > 1 && (
                <div className="mt-3">
                  {card.agentRuns
                    .filter((r) => r.id !== currentRun.id)
                    .sort((a, b) => a.attempt - b.attempt)
                    .map((run) => (
                      <details key={run.id} className="mt-2">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                          Attempt {run.attempt} — click to expand
                        </summary>
                        <div className="mt-2">
                          <AgentOutputPanel output={run.output} isLive={false} />
                        </div>
                      </details>
                    ))}
                </div>
              )}
            </>
          ) : (
            <AgentOutputPanel output="" isLive={false} />
          )}
        </div>

        {/* Retry schedule (failed) */}
        {card.agentStatus === 'failed' && card.agentRuns.length > 0 && (
          <RetrySchedulePanel agentRuns={card.agentRuns} />
        )}

        {/* Revision context form (revision column) */}
        {isInRevisionColumn && <RevisionContextForm cardId={card.id} />}

        {/* Pending approval actions */}
        {card.agentStatus === 'pending-approval' && (
          <PendingApprovalActions cardId={card.id} />
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
