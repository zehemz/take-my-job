'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useKobaniStore } from '@/lib/store';
import { VALID_TRANSITIONS } from '@/lib/kanban-types';
import type { Card, ColumnType } from '@/lib/kanban-types';
import Column from './Column';
import KanbanCard from './KanbanCard';

interface Props {
  boardId: string;
}

export default function KanbanBoard({ boardId }: Props) {
  // Selecting the full arrays and filtering with useMemo prevents the
  // .filter().sort() inline selector from returning a new reference on
  // every useSyncExternalStore call, which would cause an infinite render loop.
  const fetchBoard = useKobaniStore((s) => s.fetchBoard);
  const allColumns = useKobaniStore((s) => s.columns);
  const columns = useMemo(
    () => allColumns.filter((c) => c.boardId === boardId).sort((a, b) => a.position - b.position),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allColumns, boardId]
  );
  const cards = useKobaniStore((s) => s.cards);
  const moveCard = useKobaniStore((s) => s.moveCard);
  const reorderCard = useKobaniStore((s) => s.reorderCard);
  const moveCardApi = useKobaniStore((s) => s.moveCardApi);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [savedCardState, setSavedCardState] = useState<{ id: string; columnId: string; position: number } | null>(null);
  const [dragSourceColumnType, setDragSourceColumnType] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const ACTIVE_AGENT_STATUSES = new Set(['running', 'evaluating']);

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    if (card) {
      setActiveCard(card);
      setSavedCardState({ id: card.id, columnId: card.columnId, position: card.position });
      const sourceColumn = columns.find((col) => col.id === card.columnId);
      setDragSourceColumnType(sourceColumn?.type ?? null);
    }
    setDragError(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    setDragSourceColumnType(null);
    const { active, over } = event;

    const activeId = active.id as string;
    const activeCardItem = cards.find((c) => c.id === activeId);

    // Block move if card has an active agent run
    if (activeCardItem && ACTIVE_AGENT_STATUSES.has(activeCardItem.agentStatus)) {
      if (savedCardState) {
        moveCard(savedCardState.id, savedCardState.columnId, savedCardState.position);
      }
      setSavedCardState(null);
      setDragError('Cannot move a card while an agent is running.');
      return;
    }

    // Capture before clearing — needed for revert in transition checks below
    const savedState = savedCardState;
    setSavedCardState(null);
    setDragError(null);

    if (!over) return;

    const overId = over.id as string;

    // If dropped onto a column droppable
    if (overId.startsWith('column:')) {
      const targetColumnId = overId.replace('column:', '');
      if (!activeCardItem) return;

      if (activeCardItem.columnId !== targetColumnId) {
        const targetColumn = columns.find((col) => col.id === targetColumnId);
        const sourceColumn = columns.find((col) => col.id === activeCardItem.columnId);
        const allowedTargets = sourceColumn ? (VALID_TRANSITIONS[sourceColumn.type] ?? []) : [];
        if (targetColumn && !allowedTargets.includes(targetColumn.type)) {
          // Invalid column transition — revert
          if (savedState) {
            moveCard(savedState.id, savedState.columnId, savedState.position);
          }
          setDragError(`Cannot move from ${sourceColumn?.type ?? '?'} to ${targetColumn.type}.`);
          return;
        }

        // active → review requires agent to have completed with all criteria passing
        if (sourceColumn?.type === 'active' && targetColumn?.type === 'review' && activeCardItem.agentStatus !== 'completed') {
          if (savedState) {
            moveCard(savedState.id, savedState.columnId, savedState.position);
          }
          setDragError('Card can only move to review after the agent completes with all criteria passing.');
          return;
        }

        const colCards = cards
          .filter((c) => c.columnId === targetColumnId)
          .sort((a, b) => a.position - b.position);
        moveCard(activeId, targetColumnId, colCards.length);
        const moveError = await moveCardApi(activeId, targetColumnId, colCards.length);
        if (moveError) {
          await fetchBoard(boardId);
          setDragError(moveError);
        }
      }
      return;
    }

    // If dropped onto another card
    const overCard = cards.find((c) => c.id === overId);
    if (!overCard || !activeCardItem) return;

    if (activeCardItem.columnId === overCard.columnId) {
      // Same column — reorder
      reorderCard(activeId, overCard.position);
      moveCardApi(activeId, activeCardItem.columnId, overCard.position);
    } else {
      // Different column — check transition validity first
      const targetColumn = columns.find((col) => col.id === overCard.columnId);
      const sourceColumn = columns.find((col) => col.id === activeCardItem.columnId);
      const allowedTargets = sourceColumn ? (VALID_TRANSITIONS[sourceColumn.type] ?? []) : [];
      if (targetColumn && !allowedTargets.includes(targetColumn.type)) {
        if (savedState) moveCard(savedState.id, savedState.columnId, savedState.position);
        setDragError(`Cannot move from ${sourceColumn?.type ?? '?'} to ${targetColumn.type}.`);
        return;
      }
      if (sourceColumn?.type === 'active' && targetColumn?.type === 'review' && activeCardItem.agentStatus !== 'completed') {
        if (savedState) moveCard(savedState.id, savedState.columnId, savedState.position);
        setDragError('Card can only move to review after the agent completes with all criteria passing.');
        return;
      }
      moveCard(activeId, overCard.columnId, overCard.position);
      const moveError = await moveCardApi(activeId, overCard.columnId, overCard.position);
      if (moveError) {
        await fetchBoard(boardId);
        setDragError(moveError);
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If over a column, move card there temporarily
    if (overId.startsWith('column:')) {
      const targetColumnId = overId.replace('column:', '');
      const activeCardItem = cards.find((c) => c.id === activeId);
      if (!activeCardItem || activeCardItem.columnId === targetColumnId) return;
      const colCards = cards
        .filter((c) => c.columnId === targetColumnId)
        .sort((a, b) => a.position - b.position);
      moveCard(activeId, targetColumnId, colCards.length);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={() => { setActiveCard(null); setDragSourceColumnType(null); }}
    >
      {dragError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {dragError}
        </div>
      )}
      <div className="flex flex-row flex-nowrap gap-3 px-4 py-4 overflow-x-auto overflow-y-hidden h-full items-start">
        {columns.map((column) => {
          const allowed = dragSourceColumnType ? (VALID_TRANSITIONS[dragSourceColumnType as ColumnType] ?? []) : null;
          const isValidDropTarget = allowed === null || allowed.includes(column.type);
          return (
            <Column key={column.id} column={column} isValidDropTarget={isValidDropTarget} />
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="opacity-80 rotate-1 scale-105 shadow-2xl">
            <KanbanCard card={activeCard} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
