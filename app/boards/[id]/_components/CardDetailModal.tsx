'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useKobaniStore } from '@/lib/store';
import type { AgentRun, AgentRole } from '@/lib/kanban-types';
import type { ApiCard, ApiAcceptanceCriterion, SseEvent, UpdateCardRequest } from '@/lib/api-types';
import AgentStatusBadge from '@/app/_components/AgentStatusBadge';
import AcceptanceCriteriaList from './AcceptanceCriteriaList';
import AgentOutputPanel from './AgentOutputPanel';
import { relativeTime } from '@/lib/timeUtils';

const AGENT_ROLES: AgentRole[] = [
  'backend-engineer',
  'qa-engineer',
  'tech-lead',
  'content-writer',
  'product-spec-writer',
  'designer',
];

const INPUT_CLASS =
  'bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-colors';
const SAVE_BTN =
  'bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer';
const CANCEL_BTN = 'text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer';

// ─── Inline save/cancel row ───────────────────────────────────────────────────

function SaveCancelRow({
  onSave,
  onCancel,
  saving,
  error,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  return (
    <div className="flex items-center gap-3 mt-1.5">
      <button
        onClick={onSave}
        disabled={saving}
        className={SAVE_BTN + (saving ? ' opacity-60 pointer-events-none' : '')}
      >
        Save
      </button>
      <button onClick={onCancel} className={CANCEL_BTN}>
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ─── BlockedBanner ────────────────────────────────────────────────────────────

function BlockedBanner({
  cardId,
  blockedReason,
  sessionId,
  onReplied,
}: {
  cardId: string;
  blockedReason: string;
  sessionId: string | null;
  onReplied: () => void;
}) {
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const cliCommand = sessionId ? `ant sessions connect ${sessionId}` : null;

  async function handleSendReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) {
        console.error('[BlockedBanner] reply failed', await res.text());
        return;
      }
      setReply('');
      onReplied();
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    if (!cliCommand) return;
    navigator.clipboard.writeText(cliCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-6 my-4 bg-amber-950 border border-amber-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-sm">⚠</span>
        <span className="text-sm font-semibold text-amber-200">Agent needs your input</span>
      </div>
      <p className="text-sm text-amber-200 leading-relaxed">{blockedReason}</p>
      <textarea
        className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors disabled:opacity-60"
        rows={3}
        placeholder="Reply to the agent..."
        value={reply}
        disabled={sending}
        onChange={(e) => setReply(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        {cliCommand ? (
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 min-w-0">
            <code className="text-xs font-mono text-zinc-500 truncate">{cliCommand}</code>
            <button
              onClick={handleCopy}
              className="text-xs text-zinc-500 hover:text-indigo-300 transition-colors cursor-pointer shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={handleSendReply}
          disabled={sending || !reply.trim()}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending…' : 'Send to agent'}
        </button>
      </div>
    </div>
  );
}

// ─── RevisionContextForm ──────────────────────────────────────────────────────

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

// ─── PendingApprovalBanner ────────────────────────────────────────────────────

function PendingApprovalBanner() {
  return (
    <div className="mx-6 mt-2 bg-indigo-950 border border-indigo-800 rounded-lg px-4 py-3 shrink-0">
      <p className="text-sm text-indigo-200 font-medium">This card is awaiting your review.</p>
      <p className="text-xs text-indigo-400 mt-1">All acceptance criteria passed. Approve to close or request changes.</p>
    </div>
  );
}

// ─── PendingApprovalActions ───────────────────────────────────────────────────

function PendingApprovalActions({ cardId, criteria }: { cardId: string; criteria: ApiAcceptanceCriterion[] }) {
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const approveCard = useKobaniStore((s) => s.approveCard);
  const requestRevision = useKobaniStore((s) => s.requestRevision);
  const closeCardDetail = useKobaniStore((s) => s.closeCardDetail);

  async function handleApprove() {
    if (!confirmed || approving) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approveCard(cardId);
      closeCardDetail();
    } catch {
      setApproveError('Something went wrong. Please try again.');
      setApproving(false);
    }
  }

  function handleRequestRevision() {
    if (showRevisionForm && revisionNote.trim()) {
      requestRevision(cardId, revisionNote);
      closeCardDetail();
    } else {
      setShowConfirmation(false);
      setConfirmed(false);
      setApproveError(null);
      setShowRevisionForm(true);
    }
  }

  const approveButtonDisabled = showConfirmation && (!confirmed || approving);
  const approveButtonClasses = approveButtonDisabled
    ? 'bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium opacity-40 pointer-events-none cursor-not-allowed'
    : approving
      ? 'bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium opacity-60 pointer-events-none cursor-not-allowed'
      : 'bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer';

  const revisionButtonClasses = approving
    ? 'border border-red-500 text-red-400 bg-transparent rounded-md px-3 py-1.5 text-sm font-medium opacity-50 pointer-events-none'
    : 'border border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer';

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
      {showConfirmation && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Approval Review</p>
          <div className={`bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 flex flex-col gap-3${criteria.length >= 7 ? ' max-h-48 overflow-y-auto' : ''}`}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-800">
              Acceptance Criteria &amp; Evidence
            </p>
            {criteria.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 ${c.passed ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {c.passed ? '✅' : '·'}
                  </span>
                  <span className="text-sm text-zinc-300">{c.text}</span>
                </div>
                {c.evidence ? (
                  <p className="ml-6 text-xs text-zinc-500 font-mono">{c.evidence}</p>
                ) : (
                  <p className="ml-6 text-xs text-zinc-600 italic">No evidence provided.</p>
                )}
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border border-zinc-600 bg-zinc-950 accent-indigo-600 cursor-pointer shrink-0 mt-0.5"
            />
            <span className="text-sm text-zinc-300 leading-relaxed cursor-pointer select-none">
              I have reviewed all acceptance criteria and confirm this work meets the requirements.
            </span>
          </label>
          {approveError && (
            <p className="text-xs text-red-400">{approveError}</p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        {showConfirmation ? (
          <span
            className="text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
            onClick={() => { setShowConfirmation(false); setConfirmed(false); setApproveError(null); }}
          >
            ← Back
          </span>
        ) : (
          <button
            onClick={handleRequestRevision}
            className={revisionButtonClasses}
          >
            ✗ Request Revision
          </button>
        )}
        <button
          onClick={showConfirmation ? handleApprove : () => setShowConfirmation(true)}
          className={approveButtonClasses}
        >
          {approving ? '↻ Approving…' : '✓ Approve & Close'}
        </button>
      </div>
    </div>
  );
}

// ─── RetrySchedulePanel ───────────────────────────────────────────────────────

function RetrySchedulePanel({
  cardId,
  agentRuns,
  maxAttempts,
  onRetried,
}: {
  cardId: string;
  agentRuns: AgentRun[];
  maxAttempts: number;
  onRetried: () => void;
}) {
  const sorted = [...agentRuns].sort((a, b) => a.attempt - b.attempt);
  const lastRun = sorted[sorted.length - 1];
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');

  async function handleRetryNow() {
    setRetrying(true);
    setRetryError('');
    try {
      const res = await fetch(`/api/cards/${cardId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('retry failed');
      onRetried();
    } catch {
      setRetryError('Could not retry. Try again.');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="px-6 py-4 border-t border-zinc-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Retry Schedule</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetryNow}
            disabled={retrying}
            className={`bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer${retrying ? ' opacity-60 pointer-events-none' : ''}`}
          >
            {retrying ? 'Retrying…' : 'Retry now'}
          </button>
        </div>
      </div>
      {retryError && <span className="text-red-400 text-xs">{retryError}</span>}
      <div className="flex flex-col gap-2">
        {sorted.map((run) => (
          <div key={run.id} className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Attempt {run.attempt} of {maxAttempts}</span>
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

// ─── CardDetailModal ──────────────────────────────────────────────────────────

export default function CardDetailModal() {
  const selectedCardId = useKobaniStore((s) => s.selectedCardId);
  const closeCardDetail = useKobaniStore((s) => s.closeCardDetail);
  const cards = useKobaniStore((s) => s.cards);
  const columns = useKobaniStore((s) => s.columns);
  const deleteCard = useKobaniStore((s) => s.deleteCard);

  const storeCard = cards.find((c) => c.id === selectedCardId);
  const column = storeCard ? columns.find((col) => col.id === storeCard.columnId) : null;

  // ── 1. Fresh API data ──────────────────────────────────────────────────────
  const [apiCard, setApiCard] = useState<ApiCard | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // ── 2. SSE live output ────────────────────────────────────────────────────
  const [sseOutput, setSseOutput] = useState('');
  const esRef = useRef<EventSource | null>(null);

  // ── 3. Edit state ─────────────────────────────────────────────────────────
  type EditingField = 'title' | 'description' | 'criteria' | 'role' | 'githubRepo' | 'githubBranch' | null;
  const [editingField, setEditingField] = useState<EditingField>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [criteriaDraft, setCriteriaDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<AgentRole>('backend-engineer');
  const [repoDraft, setRepoDraft] = useState('');
  const [branchDraft, setBranchDraft] = useState('');

  const [savingField, setSavingField] = useState<EditingField>(null);
  const [saveError, setSaveError] = useState('');

  // ── 4. Delete state ───────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNote, setDeleteNote] = useState('');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchCard(cardId: string) {
    try {
      setLoadingCard(true);
      const res = await fetch(`/api/cards/${cardId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data: ApiCard = await res.json();
      setApiCard(data);
    } catch (err) {
      console.error('[CardDetailModal] fetch card failed:', err);
    } finally {
      setLoadingCard(false);
    }
  }

  // Fetch on open / card change
  useEffect(() => {
    if (!selectedCardId) {
      setApiCard(null);
      setSseOutput('');
      setEditingField(null);
      setDeleteConfirm(false);
      setDeleteError('');
      setDeleteNote('');
      return;
    }
    setApiCard(null);
    setSseOutput('');
    fetchCard(selectedCardId);
  }, [selectedCardId]);

  // Re-fetch when store card updates (e.g. from board polling)
  const storeUpdatedAt = storeCard?.updatedAt;
  const apiUpdatedAt = apiCard?.updatedAt;
  useEffect(() => {
    if (selectedCardId && storeUpdatedAt && apiUpdatedAt && storeUpdatedAt > apiUpdatedAt) {
      fetchCard(selectedCardId);
    }
  }, [selectedCardId, storeUpdatedAt, apiUpdatedAt]);

  // SSE connection when card is live
  useEffect(() => {
    const status = apiCard?.agentStatus ?? storeCard?.agentStatus;
    const cardId = selectedCardId;
    const isLiveStatus = status === 'running' || status === 'evaluating';

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    if (!cardId || !isLiveStatus) return;

    const es = new EventSource(`/api/events/${cardId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      let event: SseEvent;
      try {
        event = JSON.parse(e.data) as SseEvent;
      } catch {
        return;
      }

      if (event.type === 'agent_message') {
        setSseOutput((prev) => prev + event.text);
      } else if (event.type === 'status_change' || event.type === 'card_update') {
        fetchCard(cardId);
      } else if (event.type === 'done') {
        es.close();
        esRef.current = null;
        fetchCard(cardId);
      }
    };

    es.onerror = (err) => {
      console.error('[CardDetailModal] SSE error:', err);
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, apiCard?.agentStatus]);

  // Scroll lock
  useEffect(() => {
    if (storeCard) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [storeCard]);

  // Keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingField) {
          setEditingField(null);
          setSaveError('');
        } else {
          closeCardDetail();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeCardDetail, editingField]);

  // Cleanup delete timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  if (!storeCard || !column) return null;

  // Merge: use API data where available, fall back to store card fields
  const card = apiCard
    ? {
        ...storeCard,
        title: apiCard.title,
        description: apiCard.description,
        acceptanceCriteria: apiCard.acceptanceCriteria,
        agentStatus: apiCard.agentStatus,
        currentAgentRunId: apiCard.currentAgentRunId,
        agentRuns: apiCard.agentRuns as AgentRun[],
        githubRepo: apiCard.githubRepo,
        githubBranch: apiCard.githubBranch,
        approvedBy: apiCard.approvedBy,
        approvedAt: apiCard.approvedAt,
        requiresApproval: apiCard.requiresApproval ?? storeCard.requiresApproval,
        movedToColumnAt: apiCard.movedToColumnAt ?? storeCard.movedToColumnAt,
        revisionContextNote: apiCard.revisionContextNote,
        maxAttempts: apiCard.maxAttempts,
      }
    : storeCard;

  const currentRun = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
  const isLive = card.agentStatus === 'running' || card.agentStatus === 'evaluating';
  const blockedRun = card.agentRuns.find((r) => r.status === 'blocked');
  const isInRevisionColumn = column.type === 'revision';
  const isEditable = column.type === 'inactive';
  const liveOutput = sseOutput || currentRun?.output || '';

  // ── Edit helpers ───────────────────────────────────────────────────────────

  function openEdit(field: EditingField) {
    if (!isEditable) return;
    setSaveError('');
    setEditingField(field);
    if (field === 'title') setTitleDraft(card.title);
    if (field === 'description') setDescDraft(card.description ?? '');
    if (field === 'criteria') {
      setCriteriaDraft(card.acceptanceCriteria.map((c) => c.text).join('\n'));
    }
    if (field === 'role') setRoleDraft(card.role as AgentRole);
    if (field === 'githubRepo') setRepoDraft(card.githubRepo ?? '');
    if (field === 'githubBranch') setBranchDraft(card.githubBranch ?? '');
  }

  function cancelEdit() {
    setEditingField(null);
    setSaveError('');
  }

  async function patchCard(payload: UpdateCardRequest) {
    const res = await fetch(`/api/cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('patch failed');
    await fetchCard(card.id);
  }

  async function saveField(field: EditingField, payload: UpdateCardRequest) {
    setSavingField(field);
    setSaveError('');
    try {
      await patchCard(payload);
      setEditingField(null);
    } catch {
      setSaveError('Could not save. Try again.');
    } finally {
      setSavingField(null);
    }
  }

  function saveTitle() {
    if (!titleDraft.trim()) return;
    saveField('title', { title: titleDraft.trim() });
  }

  function saveDescription() {
    saveField('description', { description: descDraft });
  }

  function saveCriteria() {
    const lines = criteriaDraft.split('\n').map((l) => l.trim()).filter(Boolean);
    const existingMap = new Map(card.acceptanceCriteria.map((c) => [c.text, c]));
    const newCriteria: ApiAcceptanceCriterion[] = lines.map((text) => {
      const existing = existingMap.get(text);
      return existing
        ? { id: existing.id, text: existing.text, passed: existing.passed, evidence: existing.evidence }
        : { id: crypto.randomUUID(), text, passed: null, evidence: null };
    });
    saveField('criteria', { acceptanceCriteria: newCriteria });
  }

  function saveRole() {
    saveField('role', { role: roleDraft });
  }

  function saveGithubRepo() {
    saveField('githubRepo', { githubRepo: repoDraft.trim() || undefined });
  }

  function saveGithubBranch() {
    saveField('githubBranch', { githubBranch: branchDraft.trim() || undefined });
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────

  function handleDeleteClick() {
    if (card.agentStatus === 'running' || card.agentStatus === 'evaluating') {
      setDeleteNote('Stop the agent before deleting.');
      return;
    }
    setDeleteNote('');
    setDeleteError('');
    setDeleteConfirm(true);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = setTimeout(() => {
      setDeleteConfirm(false);
      setDeleteNote('');
    }, 5000);
  }

  function handleDeleteCancel() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeleteConfirm(false);
    setDeleteNote('');
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (deleteRunning) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeleteRunning(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('delete failed');
      deleteCard(card.id);
      closeCardDetail();
    } catch {
      setDeleteError('Could not delete card. Try again.');
      setDeleteConfirm(false);
    } finally {
      setDeleteRunning(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isSaving = (field: EditingField) => savingField === field;

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={closeCardDetail}
    >
      <div
        data-testid="card-detail-modal"
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full mx-3 max-h-[95vh] md:max-w-2xl md:mx-auto md:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 shrink-0">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0 mr-3">
            {/* Title */}
            {editingField === 'title' ? (
              <div className={isSaving('title') ? 'opacity-60 pointer-events-none' : ''}>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-indigo-500 text-base font-semibold text-zinc-100 outline-none pb-0.5 focus:border-indigo-400"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
                  autoFocus
                  placeholder="Card title"
                />
                <SaveCancelRow
                  onSave={saveTitle}
                  onCancel={cancelEdit}
                  saving={isSaving('title')}
                  error={editingField === 'title' ? saveError : ''}
                />
              </div>
            ) : (
              <h2
                className={`text-base font-semibold text-zinc-100 transition-colors ${isEditable ? 'cursor-pointer hover:text-zinc-300' : ''}`}
                onClick={() => openEdit('title')}
                title={isEditable ? 'Click to edit title' : undefined}
              >
                {card.title}
              </h2>
            )}

            <div className="flex items-center gap-2">
              {loadingCard ? (
                <div className="h-5 w-20 rounded bg-zinc-600 animate-pulse" />
              ) : (
                <AgentStatusBadge
                  status={card.agentStatus}
                  retryAfterMs={currentRun?.retryAfterMs}
                />
              )}
              <span className="text-xs text-zinc-500">
                {relativeTime(card.movedToColumnAt)} in {column.name}
              </span>
            </div>
            {card.approvedBy && (
              <span className="text-xs text-zinc-500">Approved by @{card.approvedBy.replace(/^@/, '')}</span>
            )}
          </div>
          <button
            onClick={closeCardDetail}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Pending-approval banner */}
        {card.agentStatus === 'pending-approval' && <PendingApprovalBanner />}

        {/* Meta row */}
        {currentRun && (
          <div className="px-6 py-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500 shrink-0 border-t border-zinc-800">
            {/* Role */}
            <span className="flex items-center gap-1">
              Role:{' '}
              {editingField === 'role' ? (
                <span className={`flex items-center gap-1 ${isSaving('role') ? 'opacity-60 pointer-events-none' : ''}`}>
                  <select
                    className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value as AgentRole)}
                  >
                    {AGENT_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button onClick={saveRole} className={SAVE_BTN}>Save</button>
                  <button onClick={cancelEdit} className={CANCEL_BTN}>Cancel</button>
                  {saveError && editingField === 'role' && (
                    <span className="text-xs text-red-400">{saveError}</span>
                  )}
                </span>
              ) : (
                <span
                  className={`text-zinc-300 bg-zinc-800 rounded px-1.5 py-0.5 font-mono text-xs transition-colors ${isEditable ? 'cursor-pointer hover:bg-zinc-700' : ''}`}
                  onClick={() => openEdit('role')}
                  title={isEditable ? 'Click to edit role' : undefined}
                >
                  {currentRun.role}{isEditable ? ' ✎' : ''}
                </span>
              )}
            </span>

            <span>
              Attempt: <span className="text-zinc-300">{currentRun.attempt} / {card.maxAttempts ?? 5}</span>
            </span>
            <span>
              Started: <span className="text-zinc-300">{relativeTime(currentRun.startedAt)} ago</span>
            </span>

            {/* GitHub Repo */}
            {editingField === 'githubRepo' ? (
              <span className={`flex items-center gap-1 ${isSaving('githubRepo') ? 'opacity-60 pointer-events-none' : ''}`}>
                <span className="text-zinc-500">Repo:</span>
                <input
                  type="text"
                  className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-0.5 text-xs text-zinc-100 font-mono outline-none transition-colors w-40"
                  value={repoDraft}
                  onChange={(e) => setRepoDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveGithubRepo(); }}
                  placeholder="owner/repo"
                  autoFocus
                />
                <button onClick={saveGithubRepo} className={SAVE_BTN}>Save</button>
                <button onClick={cancelEdit} className={CANCEL_BTN}>Cancel</button>
                {saveError && editingField === 'githubRepo' && (
                  <span className="text-xs text-red-400">{saveError}</span>
                )}
              </span>
            ) : card.githubRepo ? (
              <span
                className={`flex items-center gap-1 transition-colors ${isEditable ? 'cursor-pointer hover:text-zinc-300' : ''}`}
                onClick={() => openEdit('githubRepo')}
                title={isEditable ? 'Click to edit repo' : undefined}
              >
                Repo: <span className="text-zinc-300 font-mono">{card.githubRepo}</span>
                {isEditable && <span className="text-zinc-600">✎</span>}
              </span>
            ) : isEditable ? (
              <span
                className="text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors"
                onClick={() => openEdit('githubRepo')}
              >
                + Add repo
              </span>
            ) : null}

            {/* GitHub Branch */}
            {editingField === 'githubBranch' ? (
              <span className={`flex items-center gap-1 ${isSaving('githubBranch') ? 'opacity-60 pointer-events-none' : ''}`}>
                <span className="text-zinc-500">Branch:</span>
                <input
                  type="text"
                  className="bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-0.5 text-xs text-zinc-100 font-mono outline-none transition-colors w-32"
                  value={branchDraft}
                  onChange={(e) => setBranchDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveGithubBranch(); }}
                  placeholder="main"
                  autoFocus
                />
                <button onClick={saveGithubBranch} className={SAVE_BTN}>Save</button>
                <button onClick={cancelEdit} className={CANCEL_BTN}>Cancel</button>
                {saveError && editingField === 'githubBranch' && (
                  <span className="text-xs text-red-400">{saveError}</span>
                )}
              </span>
            ) : card.githubBranch ? (
              <span
                className={`flex items-center gap-1 transition-colors ${isEditable ? 'cursor-pointer hover:text-zinc-300' : ''}`}
                onClick={() => openEdit('githubBranch')}
                title={isEditable ? 'Click to edit branch' : undefined}
              >
                Branch: <span className="text-zinc-300 font-mono">{card.githubBranch}</span>
                {isEditable && <span className="text-zinc-600">✎</span>}
              </span>
            ) : isEditable ? (
              <span
                className="text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors"
                onClick={() => openEdit('githubBranch')}
              >
                + Add branch
              </span>
            ) : null}
          </div>
        )}

        {/* Description */}
        <div className="px-6 py-3 border-t border-zinc-800">
          {editingField === 'description' ? (
            <div className={isSaving('description') ? 'opacity-60 pointer-events-none' : ''}>
              <textarea
                className={`w-full ${INPUT_CLASS} placeholder-zinc-600 resize-none`}
                rows={4}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                autoFocus
                placeholder="Describe the work for the agent..."
              />
              <SaveCancelRow
                onSave={saveDescription}
                onCancel={cancelEdit}
                saving={isSaving('description')}
                error={editingField === 'description' ? saveError : ''}
              />
            </div>
          ) : card.description ? (
            <p
              className={`text-sm text-zinc-300 leading-relaxed transition-colors ${isEditable ? 'cursor-pointer hover:text-zinc-200' : ''}`}
              onClick={() => openEdit('description')}
              title={isEditable ? 'Click to edit description' : undefined}
            >
              {card.description}
            </p>
          ) : isEditable ? (
            <p
              className="text-sm text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={() => openEdit('description')}
            >
              No description. Click to add one.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">No description.</p>
          )}
        </div>

        {/* Blocked banner */}
        {card.agentStatus === 'blocked' && blockedRun?.blockedReason && (
          <BlockedBanner
            cardId={card.id}
            blockedReason={blockedRun.blockedReason}
            sessionId={blockedRun.sessionId ?? null}
            onReplied={() => fetchCard(card.id)}
          />
        )}

        {/* Acceptance Criteria */}
        <div className="px-6 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Acceptance Criteria
            </p>
            {editingField !== 'criteria' && isEditable && (
              <button
                className="text-zinc-600 hover:text-zinc-400 text-xs cursor-pointer transition-colors"
                onClick={() => openEdit('criteria')}
              >
                Edit
              </button>
            )}
          </div>

          {editingField === 'criteria' ? (
            <div className={isSaving('criteria') ? 'opacity-60 pointer-events-none' : ''}>
              <textarea
                className={`w-full ${INPUT_CLASS} placeholder-zinc-600 resize-none`}
                rows={Math.max(4, card.acceptanceCriteria.length + 1)}
                value={criteriaDraft}
                onChange={(e) => setCriteriaDraft(e.target.value)}
                autoFocus
                placeholder="One criterion per line..."
              />
              <p className="text-xs text-zinc-600 mt-1">One criterion per line</p>
              <SaveCancelRow
                onSave={saveCriteria}
                onCancel={cancelEdit}
                saving={isSaving('criteria')}
                error={editingField === 'criteria' ? saveError : ''}
              />
            </div>
          ) : (
            <AcceptanceCriteriaList
              criteria={card.acceptanceCriteria}
              cardStatus={card.agentStatus}
            />
          )}
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
              <AgentOutputPanel output={liveOutput} isLive={isLive} />
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
          <RetrySchedulePanel
            cardId={card.id}
            agentRuns={card.agentRuns}
            maxAttempts={card.maxAttempts ?? 5}
            onRetried={() => fetchCard(card.id)}
          />
        )}

        {/* Revision context form (revision column) */}
        {isInRevisionColumn && <RevisionContextForm cardId={card.id} />}

        {/* Pending approval actions */}
        {card.agentStatus === 'pending-approval' && (
          <PendingApprovalActions cardId={card.id} criteria={card.acceptanceCriteria} />
        )}

        {/* Footer — delete affordance + retry */}
        <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {deleteConfirm ? (
              <>
                <span className="text-xs text-zinc-400">Delete this card?</span>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteRunning}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded-md px-2 py-1 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deleteRunning ? 'Deleting…' : 'Delete permanently'}
                </button>
                <button onClick={handleDeleteCancel} className={CANCEL_BTN}>
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleDeleteClick}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Delete card
                </button>
                {deleteNote && (
                  <span className="text-xs text-zinc-500">{deleteNote}</span>
                )}
                {deleteError && (
                  <span className="text-xs text-red-400">{deleteError}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
