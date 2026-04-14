import { describe, it, expect } from 'vitest'
import { mapAgentRunStatus, mapNotification } from '../api-mappers'

describe('mapAgentRunStatus', () => {
  it('maps pending to queued', () => {
    expect(mapAgentRunStatus('pending', null)).toBe('queued')
  })

  it('maps idle to idle', () => {
    expect(mapAgentRunStatus('idle', null)).toBe('idle')
  })

  it('maps cancelled to idle', () => {
    expect(mapAgentRunStatus('cancelled', null)).toBe('idle')
  })

  it('maps running to running', () => {
    expect(mapAgentRunStatus('running', null)).toBe('running')
  })

  it('maps blocked to blocked', () => {
    expect(mapAgentRunStatus('blocked', null)).toBe('blocked')
  })

  it('maps failed to failed', () => {
    expect(mapAgentRunStatus('failed', null)).toBe('failed')
  })

  it('maps completed with no criteria to completed', () => {
    expect(mapAgentRunStatus('completed', null)).toBe('completed')
  })

  it('maps completed with all passing criteria to completed', () => {
    expect(mapAgentRunStatus('completed', JSON.stringify([{ passed: true }, { passed: true }]))).toBe('completed')
  })

  it('maps completed with failing criteria to evaluation-failed', () => {
    expect(mapAgentRunStatus('completed', JSON.stringify([{ passed: true }, { passed: false }]))).toBe('evaluation-failed')
  })
})

describe('mapNotification', () => {
  it('maps a DB notification row to ApiNotification', () => {
    const row = {
      id: 'notif-1',
      cardId: 'card-1',
      boardId: 'board-1',
      type: 'failed',
      message: 'Agent run failed.',
      isRead: false,
      createdAt: new Date('2026-04-14T12:00:00Z'),
      card: { title: 'My Card' },
      board: { name: 'My Board' },
    }

    const result = mapNotification(row)

    expect(result).toEqual({
      id: 'notif-1',
      cardId: 'card-1',
      boardId: 'board-1',
      cardTitle: 'My Card',
      boardName: 'My Board',
      type: 'failed',
      message: 'Agent run failed.',
      isRead: false,
      createdAt: '2026-04-14T12:00:00.000Z',
    })
  })

  it('maps a read notification', () => {
    const row = {
      id: 'notif-2',
      cardId: 'card-2',
      boardId: 'board-1',
      type: 'blocked',
      message: 'Need credentials',
      isRead: true,
      createdAt: new Date('2026-04-14T13:00:00Z'),
      card: { title: 'Other Card' },
      board: { name: 'My Board' },
    }

    const result = mapNotification(row)

    expect(result.isRead).toBe(true)
    expect(result.type).toBe('blocked')
  })
})
