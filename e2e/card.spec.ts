import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';
import type { ApiCard } from '../lib/api-types';

/**
 * Card flows — E2E-CARD-*
 * Tests cover creation, detail view, and move via the API.
 */
test.describe('Cards', () => {
  test('E2E-CARD-001: API returns boards list with correct shape', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    if (boards.length === 0) {
      test.skip(true, 'No boards in DB');
      return;
    }

    const board = boards[0];
    expect(board).toHaveProperty('id');
    expect(board).toHaveProperty('name');
    expect(board).toHaveProperty('createdAt');
  });

  test('E2E-CARD-002: create card via UI and verify it appears on the board', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    if (boards.length === 0) {
      test.skip(true, 'No boards in DB');
      return;
    }

    const { board, columns } = await api.getBoard(boards[0].id);

    if (columns.length === 0) {
      test.skip(true, 'Board has no columns');
      return;
    }

    await page.goto(`/boards/${board.id}`);
    await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

    // Click Add card in first column
    await page.locator('[data-testid="add-card-button"]').first().click();
    await expect(page.locator('[data-testid="new-card-modal"]')).toBeVisible();

    const cardTitle = `E2E Test Card ${Date.now()}`;
    await page.locator('[data-testid="new-card-title-input"]').fill(cardTitle);
    await page.locator('[data-testid="new-card-submit"]').click();

    // Modal closes and card appears
    await expect(page.locator('[data-testid="new-card-modal"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(cardTitle)).toBeVisible({ timeout: 10_000 });

    // Cleanup: find and delete the created card
    const { cards } = await api.getBoard(board.id);
    const created = cards.find((c: ApiCard) => c.title === cardTitle);
    if (created) await api.deleteCard(created.id);
  });

  test('E2E-CARD-003: move card via API and verify new column', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    if (boards.length === 0) {
      test.skip(true, 'No boards in DB');
      return;
    }

    const { board, columns } = await api.getBoard(boards[0].id);

    if (columns.length < 2) {
      test.skip(true, 'Need at least 2 columns to test move');
      return;
    }

    // Create a card in column[0]
    const card = await api.createCard(board.id, {
      title: `E2E Move Test ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
    });

    expect(card.columnId).toBe(columns[0].id);

    // Move to column[1]
    const moved = await api.moveCard(card.id, { columnId: columns[1].id });
    expect(moved.columnId).toBe(columns[1].id);

    // Cleanup
    await api.deleteCard(card.id);
  });

  test('E2E-CARD-004: 401 on card move without session', async ({ request }) => {
    const res = await request.post('/api/cards/fake-id/move', {
      data: { columnId: 'fake-column' },
    });
    expect(res.status()).toBe(401);
  });

  test('E2E-CARD-005: 401 on card PATCH without session', async ({ request }) => {
    const res = await request.patch('/api/cards/fake-id', {
      data: { title: 'hacked' },
    });
    expect(res.status()).toBe(401);
  });
});
