'use client';

import { useState } from 'react';
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
import type { Card } from '@/lib/kanban-types';
import Column from './Column';
import KanbanCard from './KanbanCard';

interface Props {
  boardId: string;
}

export default function KanbanBoard({ boardId }: Props) {
  const columns = useKobaniStore((s) =>
    s.columns
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.position - b.position)
  );
  const cards = useKobaniStore((s) => s.cards);
  const moveCard = useKobaniStore((s) => s.moveCard);
  const reorderCard = useKobaniStore((s) => s.reorderCard);
  const moveCardApi = useKobaniStore((s) => s.moveCardApi);

  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped onto a column droppable
    if (overId.startsWith('column:')) {
      const targetColumnId = overId.replace('column:', '');
      const activeCard = cards.find((c) => c.id === activeId);
      if (!activeCard) return;

      if (activeCard.columnId !== targetColumnId) {
        const colCards = cards
          .filter((c) => c.columnId === targetColumnId)
          .sort((a, b) => a.position - b.position);
        moveCard(activeId, targetColumnId, colCards.length);
        moveCardApi(activeId, targetColumnId, colCards.length);
      }
      return;
    }

    // If dropped onto another card
    const overCard = cards.find((c) => c.id === overId);
    const activeCardItem = cards.find((c) => c.id === activeId);
    if (!overCard || !activeCardItem) return;

    if (activeCardItem.columnId === overCard.columnId) {
      // Same column — reorder
      reorderCard(activeId, overCard.position);
      moveCardApi(activeId, activeCardItem.columnId, overCard.position);
    } else {
      // Different column — move to that position
      moveCard(activeId, overCard.columnId, overCard.position);
      moveCardApi(activeId, overCard.columnId, overCard.position);
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
    >
      <div className="flex flex-row flex-nowrap gap-3 px-4 py-4 overflow-x-auto overflow-y-hidden h-full items-start">
        {columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
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
