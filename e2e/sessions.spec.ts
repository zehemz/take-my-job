import { test, expect } from './fixtures';

/**
 * Sessions list flows — E2E-SESSION-*
 * Tests cover the /sessions page rendering and API auth guards.
 */
test.describe('Sessions list', () => {
  test('E2E-SESSION-001: navigate to /sessions renders table with Status, Title, Agent columns', async ({ authedPage: page }) => {
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible({ timeout: 10_000 });

    // Wait for loading to finish — table or empty state should appear
    const table = page.locator('table');
    const emptyState = page.getByText('No sessions found');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      // Empty state is valid — verify it renders
      await expect(emptyState).toBeVisible();
      return;
    }

    // Verify column headers are present
    const headers = table.locator('thead th');
    const headerTexts = await headers.allTextContents();
    const normalized = headerTexts.map((t) => t.trim().toLowerCase());

    expect(normalized).toContain('status');
    expect(normalized).toContain('title');
    expect(normalized).toContain('agent');
  });

  test('E2E-SESSION-005: GET /api/sessions without session returns 401', async ({ request }) => {
    const res = await request.get('/api/sessions');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });
});
