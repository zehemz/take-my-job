import { create } from 'zustand';
import type { Board, Card, Column, ColumnType } from './kanban-types';
import type { ApiNotification } from './api-types';

interface KobaniState {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  selectedCardId: string | null;
  attentionDrawerOpen: boolean;
  notifications: ApiNotification[];
  unreadNotificationCount: number;
  notificationPopupOpen: boolean;
  /** Incremented while a card move is in-flight; fetchBoard skips when > 0. */
  _moveInFlight: number;

  // Board operations
  createBoard: (name: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;

  // Column operations
  createColumn: (boardId: string, name: string, type: ColumnType) => void;
  renameColumn: (columnId: string, name: string) => void;
  deleteColumn: (columnId: string) => void;
  reorderColumns: (boardId: string, orderedColumnIds: string[]) => void;

  // Card operations
  createCard: (columnId: string, boardId: string, fields: Partial<Card>) => void;
  updateCard: (cardId: string, fields: Partial<Card>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, targetColumnId: string, targetPosition: number) => void;
  reorderCard: (cardId: string, targetPosition: number) => void;

  // Modal / UI state
  openCardDetail: (cardId: string) => void;
  closeCardDetail: () => void;

  // Attention Queue actions
  approveCard: (cardId: string) => Promise<void>;
  requestRevision: (cardId: string, reason: string) => Promise<void>;
  sendRevisionContext: (cardId: string, note: string) => void;
  openAttentionDrawer: () => void;
  closeAttentionDrawer: () => void;

  // Notification actions
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  openNotificationPopup: () => void;
  closeNotificationPopup: () => void;

  // Async API actions
  fetchBoard: (boardId: string) => Promise<void>;
  fetchBoards: () => Promise<void>;
  createBoardApi: (name: string, githubRepo?: string) => Promise<string | null>; // returns new board id
  deleteBoardApi: (id: string) => Promise<boolean>;
  moveCardApi: (cardId: string, columnId: string, position?: number) => Promise<boolean>;
  createCardApi: (boardId: string, payload: {
    title: string;
    columnId: string;
    description?: string;
    acceptanceCriteria?: { id: string; text: string; passed: boolean | null; evidence: string | null }[];
    role?: string;
    githubRepo?: string;
    githubBranch?: string;
    requiresApproval?: boolean;
  }) => Promise<unknown>;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useKobaniStore = create<KobaniState>()((set, get) => ({
  boards: [],
  columns: [],
  cards: [],
  selectedCardId: null,
  attentionDrawerOpen: false,
  notifications: [],
  unreadNotificationCount: 0,
  notificationPopupOpen: false,
  _moveInFlight: 0,

  createBoard: (name) =>
    set((state) => ({
      boards: [
        ...state.boards,
        { id: `board-${generateId()}`, name, createdAt: new Date().toISOString(), githubRepo: null },
      ],
    })),

  renameBoard: (boardId, name) =>
    set((state) => ({
      boards: state.boards.map((b) => (b.id === boardId ? { ...b, name } : b)),
    })),

  deleteBoard: (boardId) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
      columns: state.columns.filter((c) => c.boardId !== boardId),
      cards: state.cards.filter((c) => c.boardId !== boardId),
    })),

  createColumn: (boardId, name, type) =>
    set((state) => {
      const maxPos = state.columns
        .filter((c) => c.boardId === boardId)
        .reduce((max, c) => Math.max(max, c.position), -1);
      return {
        columns: [
          ...state.columns,
          { id: `col-${generateId()}`, boardId, name, type, position: maxPos + 1 },
        ],
      };
    }),

  renameColumn: (columnId, name) =>
    set((state) => ({
      columns: state.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
    })),

  deleteColumn: (columnId) =>
    set((state) => ({
      columns: state.columns.filter((c) => c.id !== columnId),
      cards: state.cards.filter((c) => c.columnId !== columnId),
    })),

  reorderColumns: (boardId, orderedColumnIds) =>
    set((state) => ({
      columns: state.columns.map((c) => {
        if (c.boardId !== boardId) return c;
        const idx = orderedColumnIds.indexOf(c.id);
        return idx === -1 ? c : { ...c, position: idx };
      }),
    })),

  createCard: (columnId, boardId, fields) =>
    set((state) => {
      const maxPos = state.cards
        .filter((c) => c.columnId === columnId)
        .reduce((max, c) => Math.max(max, c.position), -1);
      const now = new Date().toISOString();
      const newCard: Card = {
        id: `card-${generateId()}`,
        columnId,
        boardId,
        position: maxPos + 1,
        title: '',
        description: '',
        acceptanceCriteria: [],
        role: 'backend-engineer',
        assignee: '@lucas',
        githubRepo: null,
        githubBranch: null,
        agentStatus: 'idle',
        currentAgentRunId: null,
        agentRuns: [],
        requiresApproval: false,
        revisionContextNote: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
        movedToColumnAt: now,
        maxAttempts: 5,
        canInteract: true,
        ...fields,
      };
      return { cards: [...state.cards, newCard] };
    }),

  updateCard: (cardId, fields) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, ...fields, updatedAt: new Date().toISOString() } : c
      ),
    })),

  deleteCard: (cardId) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) })),

  moveCard: (cardId, targetColumnId, targetPosition) =>
    set((state) => {
      const now = new Date().toISOString();
      const cardsInTarget = state.cards
        .filter((c) => c.columnId === targetColumnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);

      // Insert at targetPosition
      const reordered = [
        ...cardsInTarget.slice(0, targetPosition),
        null, // placeholder for moved card
        ...cardsInTarget.slice(targetPosition),
      ].map((c, i) =>
        c === null
          ? null
          : { ...c, position: i }
      );

      return {
        cards: state.cards.map((c) => {
          if (c.id === cardId) {
            return { ...c, columnId: targetColumnId, position: targetPosition, movedToColumnAt: now, updatedAt: now };
          }
          const updated = reordered.find((r) => r !== null && r.id === c.id);
          if (updated) return updated;
          return c;
        }),
      };
    }),

  reorderCard: (cardId, targetPosition) =>
    set((state) => {
      const card = state.cards.find((c) => c.id === cardId);
      if (!card) return {};
      const columnCards = state.cards
        .filter((c) => c.columnId === card.columnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);
      columnCards.splice(targetPosition, 0, card);
      const updatedCards = columnCards.map((c, i) => ({ ...c, position: i }));
      return {
        cards: state.cards.map((c) => {
          const updated = updatedCards.find((u) => u.id === c.id);
          return updated || c;
        }),
      };
    }),

  openCardDetail: (cardId) => set({ selectedCardId: cardId }),
  closeCardDetail: () => set({ selectedCardId: null }),

  approveCard: async (cardId) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;
    const res = await fetch(`/api/cards/${cardId}/approve`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await get().fetchBoard(card.boardId);
    }
  },

  requestRevision: async (cardId, reason) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;
    const res = await fetch(`/api/cards/${cardId}/request-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      await get().fetchBoard(card.boardId);
    }
  },

  sendRevisionContext: (cardId, note) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== cardId) return c;
        const activeCol = state.columns.find(
          (col) => col.boardId === c.boardId && col.type === 'active'
        );
        return {
          ...c,
          revisionContextNote: note,
          agentStatus: 'idle',
          columnId: activeCol ? activeCol.id : c.columnId,
          updatedAt: new Date().toISOString(),
        };
      }),
    })),

  openAttentionDrawer: () => set({ attentionDrawerOpen: true }),
  closeAttentionDrawer: () => set({ attentionDrawerOpen: false }),

  fetchNotifications: async () => {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    set({ notifications: data.notifications, unreadNotificationCount: data.unreadCount });
  },

  markNotificationsRead: async (ids: string[]) => {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notificationIds: ids }),
    });
    if (!res.ok) return;
    const data = await res.json();
    set((state) => ({
      notifications: state.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      ),
      unreadNotificationCount: data.unreadCount,
    }));
  },

  markAllNotificationsRead: async () => {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notificationIds: [] }),
    });
    if (!res.ok) return;
    const data = await res.json();
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadNotificationCount: data.unreadCount,
    }));
  },

  openNotificationPopup: () => set({ notificationPopupOpen: true }),
  closeNotificationPopup: () => set({ notificationPopupOpen: false }),

  fetchBoard: async (boardId: string) => {
    if (get()._moveInFlight > 0) return; // skip poll while move is in-flight
    const res = await fetch(`/api/boards/${boardId}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json(); // ApiBoardDetail
    set((state) => ({
      boards: [...state.boards.filter(b => b.id !== data.board.id), {
        id: data.board.id,
        name: data.board.name,
        createdAt: data.board.createdAt,
        githubRepo: data.board.githubRepo ?? null,
      }],
      columns: [...state.columns.filter(c => c.boardId !== boardId), ...data.columns.map((col: any) => ({
        id: col.id,
        boardId: col.boardId,
        name: col.name,
        position: col.position,
        type: col.type,
      }))],
      cards: [...state.cards.filter(c => c.boardId !== boardId), ...data.cards.map((card: any) => ({
        id: card.id,
        columnId: card.columnId,
        boardId: card.boardId,
        position: card.position,
        title: card.title,
        description: card.description,
        acceptanceCriteria: card.acceptanceCriteria,
        role: card.role,
        assignee: card.role, // derive from role
        githubRepo: card.githubRepo,
        githubBranch: card.githubBranch,
        agentStatus: card.agentStatus,
        currentAgentRunId: card.currentAgentRunId,
        agentRuns: card.agentRuns.map((r: any) => ({
          id: r.id,
          cardId: r.cardId,
          role: r.role,
          status: r.status,
          attempt: r.attempt,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          output: r.output,
          blockedReason: r.blockedReason,
          retryAfterMs: r.retryAfterMs,
          sessionId: r.sessionId ?? null,
          error: r.error ?? null,
        })),
        requiresApproval: card.requiresApproval ?? false,
        revisionContextNote: card.revisionContextNote,
        approvedBy: card.approvedBy,
        approvedAt: card.approvedAt,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        movedToColumnAt: card.movedToColumnAt ?? card.createdAt,
        maxAttempts: card.maxAttempts ?? 5,
        canInteract: card.canInteract ?? true,
      }))],
    }));
  },

  fetchBoards: async () => {
    const res = await fetch('/api/boards', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    set({ boards: data });
  },

  createBoardApi: async (name: string, githubRepo?: string) => {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, ...(githubRepo ? { githubRepo } : {}) }),
    });
    if (!res.ok) return null;
    const board = await res.json();
    set((state) => ({ boards: [board, ...state.boards] }));
    return board.id;
  },

  deleteBoardApi: async (id: string) => {
    const res = await fetch(`/api/boards/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) return false;
    get().deleteBoard(id);
    return true;
  },

  moveCardApi: async (cardId: string, columnId: string, position?: number) => {
    set((s) => ({ _moveInFlight: s._moveInFlight + 1 }));
    try {
      const res = await fetch(`/api/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ columnId, position }),
      });
      if (!res.ok) return false;
      const card = await res.json();
      get().updateCard(card.id, {
        columnId: card.columnId,
        position: card.position,
        movedToColumnAt: card.movedToColumnAt,
      });
      return true;
    } finally {
      set((s) => ({ _moveInFlight: s._moveInFlight - 1 }));
    }
  },

  createCardApi: async (boardId: string, payload: {
    title: string;
    columnId: string;
    description?: string;
    acceptanceCriteria?: { id: string; text: string; passed: boolean | null; evidence: string | null }[];
    role?: string;
    githubRepo?: string;
    githubBranch?: string;
    requiresApproval?: boolean;
  }) => {
    const res = await fetch(`/api/boards/${boardId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json();
  },
}));
