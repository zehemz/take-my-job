import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

/**
 * Error states — E2E-ERR-*
 * Tests cover API error responses for invalid requests.
 */
test.describe('Error states', () => {
  test('E2E-ERR-001: GET /api/boards/:id with nonexistent ID returns 404 JSON', async ({ cookieHeader, request }) => {
    const res = await request.get('/api/boards/nonexistent-board-id', {
      headers: { Cookie: cookieHeader },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('E2E-ERR-002: POST /api/boards/:id/cards with missing title returns 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const boards = await api.getBoards();

    if (boards.length === 0) {
      test.skip(true, 'No boards in DB');
      return;
    }

    const boardId = boards[0].id;

    // POST with empty body (no title, no columnId)
    const res = await request.post(`/api/boards/${boardId}/cards`, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  // E2E-ERR-003 skipped — network error mocking requires service worker or proxy
});
