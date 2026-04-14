import { prisma } from './db';

/**
 * Promote unlocked cards on an autoMode board.
 *
 * A card is "unlocked" when:
 * 1. It is in an inactive column (backlog)
 * 2. It has NO dependencies, OR all its dependencies are in terminal columns
 *
 * Unlocked cards are moved to the board's first active column (In Progress),
 * which triggers the orchestrator to dispatch agents for them.
 */
export async function promoteUnlockedCards(boardId: string): Promise<string[]> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { autoMode: true },
  });
  if (!board?.autoMode) return [];

  // Find the first active column on this board
  const activeColumn = await prisma.column.findFirst({
    where: { boardId, columnType: 'active' },
    orderBy: { position: 'asc' },
  });
  if (!activeColumn) return [];

  // Find all cards in inactive columns on this board, with their dependencies
  const backlogCards = await prisma.card.findMany({
    where: {
      boardId,
      column: { columnType: 'inactive' },
    },
    include: {
      dependsOn: {
        include: { column: true },
      },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  const promotedIds: string[] = [];

  for (const card of backlogCards) {
    const allDepsResolved = card.dependsOn.length === 0 ||
      card.dependsOn.every((dep) => dep.column.isTerminalState);

    if (!allDepsResolved) continue;

    // Get max position in the active column
    const maxPos = await prisma.card.aggregate({
      where: { columnId: activeColumn.id },
      _max: { position: true },
    });
    const newPosition = (maxPos._max.position ?? -1) + 1;

    await prisma.card.update({
      where: { id: card.id },
      data: {
        columnId: activeColumn.id,
        position: newPosition,
        movedToColumnAt: new Date(),
      },
    });

    // Insert a card_moved orchestrator event so the orchestrator picks it up
    await prisma.orchestratorEvent.create({
      data: {
        boardId,
        cardId: card.id,
        type: 'card_moved',
        payload: { newColumnId: activeColumn.id, autoPromoted: true },
      },
    });

    promotedIds.push(card.id);
  }

  return promotedIds;
}
