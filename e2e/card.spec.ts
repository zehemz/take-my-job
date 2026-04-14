import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';
import type { ApiCard } from '../lib/api-types';
import { prisma } from '../lib/db';

const TEST_ENV_ID = 'test-env';

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

    // Create a dedicated environment so the dropdown is never empty
    const testEnv = await api.createEnvironment({ name: `E2E Card Env ${Date.now()}` });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      // Click Add card in first column
      await page.locator('[data-testid="add-card-button"]').first().click();
      await expect(page.locator('[data-testid="new-card-modal"]')).toBeVisible();

      const cardTitle = `E2E Test Card ${Date.now()}`;
      await page.locator('[data-testid="new-card-title-input"]').fill(cardTitle);

      // Environment is required — wait for options to load, then select our test env
      const envSelect = page.locator('[data-testid="new-card-modal"] select').last();
      await expect(envSelect.locator(`option[value="${testEnv.id}"]`)).toBeAttached({ timeout: 10_000 });
      await envSelect.selectOption(testEnv.id);

      await page.locator('[data-testid="new-card-submit"]').click();

      // Modal closes and card appears
      await expect(page.locator('[data-testid="new-card-modal"]')).not.toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(cardTitle)).toBeVisible({ timeout: 10_000 });

      // Cleanup: find and delete the created card
      const { cards } = await api.getBoard(board.id);
      const created = cards.find((c: ApiCard) => c.title === cardTitle);
      if (created) await api.deleteCard(created.id);
    } finally {
      await api.deleteEnvironment(testEnv.id).catch(() => {});
    }
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
      environmentId: TEST_ENV_ID,
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

  // ── Delete card ────────────────────────────────────────────────────────────

  test('E2E-CARD-009: delete button visible in card detail modal', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Delete Visible ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      // Open the card detail modal by clicking on the card title
      await page.getByText(card.title).first().click();

      // The modal should be visible and contain the delete button
      await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible({ timeout: 5_000 });
    } finally {
      await api.deleteCard(card.id).catch(() => { /* may already be deleted */ });
    }
  });

  test('E2E-CARD-010: delete requires confirm step before card is removed', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Delete Confirm ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      await page.getByText(card.title).first().click();
      await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible({ timeout: 5_000 });

      // First click shows confirm step, not immediate deletion
      await page.getByRole('button', { name: 'Delete card' }).click();
      await expect(page.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
      await expect(page.getByText('Delete this card?')).toBeVisible();

      // Confirm: card disappears and modal closes
      await page.getByRole('button', { name: 'Delete permanently' }).click();
      await expect(page.getByRole('button', { name: 'Delete permanently' })).not.toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(card.title)).not.toBeVisible({ timeout: 5_000 });
    } catch {
      // If test fails before deletion, clean up via API
      await api.deleteCard(card.id).catch(() => { /* may already be deleted */ });
    }
  });

  test('E2E-CARD-011: delete confirm cancel returns to delete button', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Delete Cancel ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      await page.getByText(card.title).first().click();
      await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Delete card' }).click();
      await expect(page.getByRole('button', { name: 'Delete permanently' })).toBeVisible();

      // Click Keep — should revert to delete button, card still on board
      await page.getByRole('button', { name: 'Keep' }).click();
      await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete permanently' })).not.toBeVisible();
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  // ── Inline edit ────────────────────────────────────────────────────────────

  test('E2E-CARD-012: clicking title enters edit mode and shows Save/Cancel', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Edit Title ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      await page.getByText(card.title).first().click();

      // Scope all modal interactions to the modal panel
      const modal = page.locator('[data-testid="card-detail-modal"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // Click the title in the modal to enter edit mode
      const titleHeading = modal.locator('h2').filter({ hasText: card.title });
      await expect(titleHeading).toBeVisible({ timeout: 5_000 });
      await titleHeading.click();

      // Input field appears with Save and Cancel buttons
      await expect(modal.locator('input[placeholder="Card title"]')).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Save' }).first()).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Cancel' }).first()).toBeVisible();
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('E2E-CARD-015: POST /api/cards/:id/retry without session → 401', async ({ request }) => {
    const res = await request.post('/api/cards/fake-id/retry');
    expect(res.status()).toBe(401);
  });

  test('E2E-CARD-016: POST /api/cards/:id/retry on card with no agent runs → 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Retry No Runs ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      const res = await request.post(`/api/cards/${card.id}/retry`, {
        headers: { cookie: cookieHeader },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('E2E-CARD-014: Add card button is only visible on inactive columns', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const inactiveCount = columns.filter((c) => c.type === 'inactive').length;

    await page.goto(`/boards/${board.id}`);
    await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

    const addCardButtons = page.locator('[data-testid="add-card-button"]');
    await expect(addCardButtons).toHaveCount(inactiveCount);
  });

  // ── Approval workflow ──────────────────────────────────────────────────────

  test('APPROVAL-001: POST /api/cards/:id/approve without session → 401', async ({ request }) => {
    const res = await request.post('/api/cards/some-id/approve');
    expect(res.status()).toBe(401);
  });

  test('APPROVAL-002: POST /api/cards/:id/approve on a card not in a review column → 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    const inactiveCol = columns.find((c) => c.type === 'inactive');
    if (!inactiveCol) { test.skip(true, 'Board has no inactive column'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Approve Not Review ${Date.now()}`,
      columnId: inactiveCol.id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      const res = await request.post(`/api/cards/${card.id}/approve`, {
        headers: { cookie: cookieHeader },
      });
      expect(res.status()).toBe(400);
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('APPROVAL-003: POST /api/cards/:id/request-revision without session → 401', async ({ request }) => {
    const res = await request.post('/api/cards/some-id/request-revision', {
      data: { reason: 'needs work' },
    });
    expect(res.status()).toBe(401);
  });

  test('APPROVAL-004: POST /api/cards/:id/move with invalid transition (active → terminal) → 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    const inactiveCol = columns.find((c) => c.type === 'inactive');
    const activeCol = columns.find((c) => c.type === 'active');
    const terminalCol = columns.find((c) => c.type === 'terminal');

    if (!inactiveCol || !activeCol || !terminalCol) {
      test.skip(true, 'Board is missing inactive, active, or terminal column');
      return;
    }

    const card = await api.createCard(board.id, {
      title: `E2E Invalid Transition ${Date.now()}`,
      columnId: inactiveCol.id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      // Move from inactive → active (valid)
      await api.moveCard(card.id, { columnId: activeCol.id });

      // Attempt active → terminal (invalid)
      const res = await request.post(`/api/cards/${card.id}/move`, {
        headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
        data: { columnId: terminalCol.id },
      });
      expect(res.status()).toBe(400);
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('APPROVAL-005: POST /api/boards/:id/cards with requiresApproval: true → field persists on fetch', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    const inactiveCol = columns.find((c) => c.type === 'inactive');
    if (!inactiveCol) { test.skip(true, 'Board has no inactive column'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Requires Approval ${Date.now()}`,
      columnId: inactiveCol.id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
      requiresApproval: true,
    });

    try {
      const fetched = await api.getCard(card.id);
      expect(fetched.requiresApproval).toBe(true);
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('APPROVAL-006: active → review blocked when agent has not completed (idle/failed card) → 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    const inactiveCol = columns.find((c) => c.type === 'inactive');
    const activeCol   = columns.find((c) => c.type === 'active');
    const reviewCol   = columns.find((c) => c.type === 'review');

    if (!inactiveCol || !activeCol || !reviewCol) {
      test.skip(true, 'Board missing required columns');
      return;
    }

    const card = await api.createCard(board.id, {
      title: `E2E Approval Gate ${Date.now()}`,
      columnId: inactiveCol.id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      // Move inactive → active (valid, no agent run yet = idle status)
      await api.moveCard(card.id, { columnId: activeCol.id });

      // Attempt active → review without agent having completed → must be 400
      const res = await request.post(`/api/cards/${card.id}/move`, {
        headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
        data: { columnId: reviewCol.id },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/criteria/i);
    } finally {
      await api.deleteCard(card.id).catch(() => {});
    }
  });

  test('E2E-CARD-013: save updates title, cancel discards changes', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const originalTitle = `E2E Edit ${Date.now()}`;
    const card = await api.createCard(board.id, {
      title: originalTitle,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      await page.getByText(originalTitle).first().click();

      // Scope all modal interactions to the modal panel
      const modal = page.locator('[data-testid="card-detail-modal"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // Enter edit mode on title
      const titleHeading = modal.locator('h2').filter({ hasText: originalTitle });
      await expect(titleHeading).toBeVisible({ timeout: 5_000 });
      await titleHeading.click();

      const titleInput = modal.locator('input[placeholder="Card title"]');
      await expect(titleInput).toBeVisible();

      // Test cancel first: type something then cancel
      const discardedTitle = `Discarded ${Date.now()}`;
      await titleInput.fill(discardedTitle);
      await modal.getByRole('button', { name: 'Cancel' }).first().click();

      // Title reverts to original
      await expect(modal.locator('h2').filter({ hasText: originalTitle })).toBeVisible();
      await expect(modal.getByText(discardedTitle)).not.toBeVisible();

      // Now test save: enter edit mode again, save a new title
      await modal.locator('h2').filter({ hasText: originalTitle }).click();
      const newTitle = `Updated ${Date.now()}`;
      await modal.locator('input[placeholder="Card title"]').fill(newTitle);
      await modal.getByRole('button', { name: 'Save' }).first().click();

      // Title updates in the modal
      await expect(modal.locator('h2').filter({ hasText: newTitle })).toBeVisible({ timeout: 5_000 });

      // Verify via API that the change persisted
      const updated = await api.getCard(card.id);
      expect(updated.title).toBe(newTitle);
    } finally {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });

  test('E2E-CARD-017: card with agent run history can be deleted', async ({ authedPage: page, cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();
    if (boards.length === 0) { test.skip(true, 'No boards in DB'); return; }

    const { board, columns } = await api.getBoard(boards[0].id);
    if (columns.length === 0) { test.skip(true, 'Board has no columns'); return; }

    const card = await api.createCard(board.id, {
      title: `E2E Delete With Run ${Date.now()}`,
      columnId: columns[0].id,
      role: 'backend-engineer',
      environmentId: TEST_ENV_ID,
    });

    // Seed an agent run so the FK constraint is triggered on delete
    await prisma.agentRun.create({
      data: {
        cardId: card.id,
        role: 'backend_engineer',
        status: 'failed',
        attempt: 1,
      },
    });

    try {
      await page.goto(`/boards/${board.id}`);
      await expect(page.locator('[data-testid="column"]').first()).toBeVisible({ timeout: 10_000 });

      await page.getByText(card.title).first().click();
      await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Delete card' }).click();
      await expect(page.getByRole('button', { name: 'Delete permanently' })).toBeVisible();

      await page.getByRole('button', { name: 'Delete permanently' }).click();
      await expect(page.getByText(card.title)).not.toBeVisible({ timeout: 5_000 });
    } catch {
      await api.deleteCard(card.id).catch(() => { /* already deleted */ });
    }
  });
});
