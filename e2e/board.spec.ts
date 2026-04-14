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
    await expect(page.locator('[data-testid="board-list"]')).toBeVisible({ timeout: 10_000 });

    if (boards.length > 0) {
      await expect(page.locator('[data-testid="board-card"]').first()).toBeVisible();
    }
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
});
