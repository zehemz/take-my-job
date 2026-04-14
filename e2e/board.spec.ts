import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

/**
 * Board flows — E2E-BOARD-*
 * All tests use the authedPage fixture (fake session cookie).
 */
test.describe('Board', () => {
  test('E2E-BOARD-001: board list loads from API and renders board cards', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    await page.goto('/');
    // "All Boards" heading is always rendered — proves the page loaded and auth passed
    await expect(page.getByRole('heading', { name: 'All Boards' })).toBeVisible({ timeout: 10_000 });

    // board-list container is empty when DB has no boards (zero height → hidden)
    if (boards.length > 0) {
      await expect(page.locator('[data-testid="board-card"]').first()).toBeVisible();
    }
  });

  test('E2E-BOARD-001b: board list shows correct column and card counts', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const board = boards[0];
    expect(typeof board.columnCount).toBe('number');
    expect(typeof board.cardCount).toBe('number');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'All Boards' })).toBeVisible({ timeout: 10_000 });

    const firstCard = page.locator('[data-testid="board-card"]').first();
    await expect(firstCard).toContainText(`${board.columnCount} columns`);
    await expect(firstCard).toContainText(`${board.cardCount} cards`);
  });

  test('E2E-BOARD-002: board page loads columns from DB', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    if (boards.length === 0) {
      test.skip(true, 'No boards in DB — seed the database first');
      return;
    }

    await page.goto(`/boards/${boards[0].id}`);
    await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-BOARD-003: user avatar / initials visible in nav after auth', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="user-menu-trigger"]')).toBeVisible({ timeout: 5_000 });
  });

  test('E2E-BOARD-004: user menu dropdown shows GitHub username on click', async ({ authedPage: page }) => {
    await page.goto('/');
    await page.locator('[data-testid="user-menu-trigger"]').click();
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible();
    const usernameText = await page.locator('[data-testid="user-menu-username"]').textContent();
    expect(usernameText).toContain('@');
  });

  test('E2E-BOARD-005: sign-out returns user to /login', async ({ authedPage: page }) => {
    await page.goto('/');
    await page.locator('[data-testid="user-menu-trigger"]').click();
    await page.locator('[data-testid="sign-out-button"]').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ── Board delete ────────────────────────────────────────────────────────────

  test('E2E-BOARD-DELETE-001: delete board button visible on board detail page', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const board = await api.createBoard({ name: `E2E Delete Visible ${Date.now()}` });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="delete-board-button"]')).toBeVisible({ timeout: 10_000 });
    } finally {
      await api.deleteBoard(board.id).catch(() => { /* may already be deleted */ });
    }
  });

  test('E2E-BOARD-DELETE-002: delete modal confirm button disabled until board name typed exactly', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boardName = `E2E Delete Confirm ${Date.now()}`;
    const board = await api.createBoard({ name: boardName });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="delete-board-button"]')).toBeVisible({ timeout: 10_000 });

      // Open delete modal
      await page.locator('[data-testid="delete-board-button"]').click();
      await expect(page.locator('[data-testid="delete-board-modal"]')).toBeVisible({ timeout: 5_000 });

      // Confirm button should be disabled initially
      const confirmButton = page.locator('[data-testid="delete-board-confirm"]');
      await expect(confirmButton).toBeDisabled();

      // Type partial name — still disabled
      await page.locator('[data-testid="delete-board-name-input"]').fill(boardName.slice(0, 5));
      await expect(confirmButton).toBeDisabled();

      // Type exact name — enabled
      await page.locator('[data-testid="delete-board-name-input"]').fill(boardName);
      await expect(confirmButton).toBeEnabled();
    } finally {
      await api.deleteBoard(board.id).catch(() => { /* may already be deleted */ });
    }
  });

  test('E2E-BOARD-DELETE-003: typing board name and confirming deletes board, redirects to /', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boardName = `E2E Delete Full ${Date.now()}`;
    const board = await api.createBoard({ name: boardName });

    // No finally cleanup needed — the test itself deletes the board
    await page.goto(`/boards/${board.id}`);
    await expect(page.locator('[data-testid="delete-board-button"]')).toBeVisible({ timeout: 10_000 });

    // Open delete modal
    await page.locator('[data-testid="delete-board-button"]').click();
    await expect(page.locator('[data-testid="delete-board-modal"]')).toBeVisible({ timeout: 5_000 });

    // Type exact board name
    await page.locator('[data-testid="delete-board-name-input"]').fill(boardName);

    // Confirm deletion
    await page.locator('[data-testid="delete-board-confirm"]').click();

    // Should redirect to home (full URL includes origin)
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });

    // Board should no longer appear in the list
    await expect(page.getByRole('heading', { name: 'All Boards' })).toBeVisible({ timeout: 10_000 });

    // Verify via API that the board is gone
    const boards = await api.getBoards();
    const found = boards.find((b) => b.id === board.id);
    expect(found).toBeUndefined();
  });
});
