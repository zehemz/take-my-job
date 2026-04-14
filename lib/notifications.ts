import { prisma } from './db';
import type { ApiCard } from './api-types';

const ATTENTION_STATUSES = new Set(['blocked', 'evaluation-failed', 'pending-approval', 'failed']);

function notificationMessage(card: ApiCard): string {
  if (card.agentStatus === 'blocked') {
    const run = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
    const reason = run?.blockedReason ?? 'Agent is blocked and needs help.';
    return reason.slice(0, 200);
  }
  if (card.agentStatus === 'evaluation-failed') {
    const failedCount = card.acceptanceCriteria.filter((c) => c.passed === false).length;
    return `${failedCount} acceptance criteri${failedCount !== 1 ? 'a' : 'on'} failed evaluation.`;
  }
  if (card.agentStatus === 'pending-approval') {
    return 'All criteria passed. Awaiting human approval.';
  }
  if (card.agentStatus === 'failed') {
    const run = card.agentRuns.find((r) => r.id === card.currentAgentRunId);
    return run?.output?.slice(0, 200) ?? 'Agent run failed.';
  }
  return '';
}

/**
 * Create a notification if one doesn't already exist (unread) for this card+type.
 */
export async function createNotification(params: {
  cardId: string;
  boardId: string;
  type: string;
  message: string;
}): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: { cardId: params.cardId, type: params.type, isRead: false },
  });
  if (existing) return;
  await prisma.notification.create({ data: params });
}

/**
 * Reconcile notifications with current card states:
 * 1. Create missing notifications for cards in attention states.
 * 2. Mark stale notifications as read when cards leave attention states.
 */
export async function reconcileNotifications(cards: ApiCard[]): Promise<void> {
  const cardIds = cards.map((c) => c.id);
  if (cardIds.length === 0) return;

  // Cards currently needing attention
  const attentionCards = cards.filter((c) => ATTENTION_STATUSES.has(c.agentStatus));

  // Create missing notifications
  for (const card of attentionCards) {
    await createNotification({
      cardId: card.id,
      boardId: card.boardId,
      type: card.agentStatus,
      message: notificationMessage(card),
    });
  }

  // Build set of cardId+type combos that are currently in attention
  const activeKeys = new Set(attentionCards.map((c) => `${c.id}:${c.agentStatus}`));

  // Find unread notifications for these board's cards that are no longer in the matching state
  const unreadNotifications = await prisma.notification.findMany({
    where: { cardId: { in: cardIds }, isRead: false },
    select: { id: true, cardId: true, type: true },
  });

  const staleIds = unreadNotifications
    .filter((n) => !activeKeys.has(`${n.cardId}:${n.type}`))
    .map((n) => n.id);

  if (staleIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: staleIds } },
      data: { isRead: true },
    });
  }
}
