'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useKobaniStore } from '@/lib/store';
import type { Column as ColumnType } from '@/lib/kanban-types';
import KanbanCard from './KanbanCard';
import NewCardModal from './NewCardModal';

const COLUMN_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  inactive: { label: 'Inactive', color: 'text-zinc-500 bg-zinc-800' },
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-900/40' },
  review: { label: 'Review', color: 'text-sky-400 bg-sky-900/40' },
  revision: { label: 'Revision', color: 'text-amber-400 bg-amber-900/40' },
  terminal: { label: 'Done', color: 'text-violet-400 bg-violet-900/40' },
};

interface Props {
  column: ColumnType;
}

export default function Column({ column }: Props) {
  const cards = useKobaniStore((s) =>
    s.cards
      .filter((c) => c.columnId === column.id)
      .sort((a, b) => a.position - b.position)
  );
  const [showNewCard, setShowNewCard] = useState(false);

  const droppableId = `column:${column.id}`;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  const typeCfg = COLUMN_TYPE_LABEL[column.type] ?? COLUMN_TYPE_LABEL.inactive;
  const cardIds = cards.map((c) => c.id);

  return (
    <>
      <div
        ref={setNodeRef}
        className={`w-72 shrink-0 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl h-full transition-all duration-150 ${
          isOver ? 'ring-2 ring-indigo-500 ring-inset' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {column.name}
            </span>
            <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${typeCfg.color}`}>
              {typeCfg.label}
            </span>
          </div>
          <span className="text-xs font-medium text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">
            {cards.length}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800" />

        {/* Card list */}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-2 px-2 py-2">
            {cards.length === 0 && isOver && (
              <div className="border-2 border-dashed border-indigo-700 rounded-lg h-16 flex items-center justify-center">
                <span className="text-xs text-indigo-600">Drop here</span>
              </div>
            )}
            {cards.map((card) => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </div>
        </SortableContext>

        {/* Add card button */}
        <div className="px-2 pb-2 shrink-0">
          <button
            onClick={() => setShowNewCard(true)}
            className="w-full text-left text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-2 transition-colors duration-150 cursor-pointer"
          >
            + Add card
          </button>
        </div>
      </div>

      {showNewCard && (
        <NewCardModal
          columnId={column.id}
          boardId={column.boardId}
          onClose={() => setShowNewCard(false)}
        />
      )}
    </>
  );
}
