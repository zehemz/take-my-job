import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { createNotification, reconcileNotifications } from '../notifications'
import { prisma } from '../db'
import type { ApiCard } from '../api-types'

const mockNotification = prisma.notification as unknown as {
  findFirst: ReturnType<typeof vi.fn>
  findMany: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  updateMany: ReturnType<typeof vi.fn>
}

function makeCard(overrides: Partial<ApiCard>): ApiCard {
  return {
    id: 'card-1',
    columnId: 'col-1',
    boardId: 'board-1',
    position: 0,
    title: 'Test card',
    description: '',
    acceptanceCriteria: [],
    role: 'backend-engineer',
    githubRepo: null,
    githubBranch: null,
    agentStatus: 'idle',
    currentAgentRunId: null,
    agentRuns: [],
    requiresApproval: false,
    revisionContextNote: null,
    approvedBy: null,
    approvedAt: null,
    movedToColumnAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    maxAttempts: 5,
    ...overrides,
  }
}

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a notification when none exists', async () => {
    mockNotification.findFirst.mockResolvedValue(null)
    mockNotification.create.mockResolvedValue({})

    await createNotification({
      cardId: 'card-1',
      boardId: 'board-1',
      type: 'failed',
      message: 'Agent run failed.',
    })

    expect(mockNotification.findFirst).toHaveBeenCalledWith({
      where: { cardId: 'card-1', type: 'failed', isRead: false },
    })
    expect(mockNotification.create).toHaveBeenCalledWith({
      data: { cardId: 'card-1', boardId: 'board-1', type: 'failed', message: 'Agent run failed.' },
    })
  })

  it('skips creation when unread notification already exists (dedup)', async () => {
    mockNotification.findFirst.mockResolvedValue({ id: 'existing-1' })

    await createNotification({
      cardId: 'card-1',
      boardId: 'board-1',
      type: 'failed',
      message: 'Agent run failed.',
    })

    expect(mockNotification.create).not.toHaveBeenCalled()
  })
})

describe('reconcileNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotification.findFirst.mockResolvedValue(null)
    mockNotification.create.mockResolvedValue({})
    mockNotification.findMany.mockResolvedValue([])
  })

  it('creates notifications for cards in attention states', async () => {
    const cards = [
      makeCard({ id: 'card-1', agentStatus: 'failed' }),
      makeCard({ id: 'card-2', agentStatus: 'blocked', agentRuns: [{ id: 'run-2', cardId: 'card-2', columnId: null, role: 'backend-engineer', status: 'blocked', attempt: 1, startedAt: '', endedAt: null, output: '', blockedReason: 'Need credentials', retryAfterMs: null, sessionId: null, error: null }], currentAgentRunId: 'run-2' }),
      makeCard({ id: 'card-3', agentStatus: 'idle' }),
    ]

    await reconcileNotifications(cards)

    // Should create for card-1 (failed) and card-2 (blocked), not card-3 (idle)
    expect(mockNotification.findFirst).toHaveBeenCalledTimes(2)
    expect(mockNotification.create).toHaveBeenCalledTimes(2)
  })

  it('does not create notifications for idle/running/completed cards', async () => {
    const cards = [
      makeCard({ id: 'card-1', agentStatus: 'idle' }),
      makeCard({ id: 'card-2', agentStatus: 'running' }),
      makeCard({ id: 'card-3', agentStatus: 'completed' }),
    ]

    await reconcileNotifications(cards)

    expect(mockNotification.create).not.toHaveBeenCalled()
  })

  it('marks stale notifications as read when card leaves attention state', async () => {
    const cards = [
      makeCard({ id: 'card-1', agentStatus: 'idle' }), // was failed, now idle
    ]

    mockNotification.findMany.mockResolvedValue([
      { id: 'notif-1', cardId: 'card-1', type: 'failed' },
    ])

    await reconcileNotifications(cards)

    expect(mockNotification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['notif-1'] } },
      data: { isRead: true },
    })
  })

  it('does not mark notifications as stale if card is still in that state', async () => {
    const cards = [
      makeCard({ id: 'card-1', agentStatus: 'failed' }),
    ]

    mockNotification.findMany.mockResolvedValue([
      { id: 'notif-1', cardId: 'card-1', type: 'failed' },
    ])

    await reconcileNotifications(cards)

    // updateMany should not be called since there are no stale notifications
    expect(mockNotification.updateMany).not.toHaveBeenCalled()
  })

  it('does nothing for empty card list', async () => {
    await reconcileNotifications([])

    expect(mockNotification.findFirst).not.toHaveBeenCalled()
    expect(mockNotification.create).not.toHaveBeenCalled()
    expect(mockNotification.findMany).not.toHaveBeenCalled()
  })
})
