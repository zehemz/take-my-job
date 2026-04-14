import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

/**
 * Agent management flows — E2E-AGENT-*
 * Tests cover the /agents list page, detail page, and API auth guards.
 */
test.describe('Agent management', () => {
  test('E2E-AGENT-001: authenticated visit to /agents renders page heading "Agents"', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-AGENT-002: /agents lists at least one row when agents exist', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    // Wait for loading to finish — table or empty state should appear
    const table = page.locator('table');
    const emptyState = page.getByText('No agents configured');

    // One of these must appear within timeout
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      test.skip(true, 'No agents in DB — cannot verify table rows');
      return;
    }

    // At least one data row (tbody tr)
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('E2E-AGENT-003: /agents shows empty state message when no agents', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    const emptyState = page.getByText('No agents configured');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const emptyVisible = await emptyState.isVisible();
    if (!emptyVisible) {
      test.skip(true, 'Agents exist — cannot verify empty state');
      return;
    }

    await expect(emptyState).toBeVisible();
  });

  test('E2E-AGENT-004: GET /api/agents without session returns 401', async ({ request }) => {
    const res = await request.get('/api/agents');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  test('E2E-AGENT-005: each agent row displays role, name, model, agent ID, version columns', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    const emptyState = page.getByText('No agents configured');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      test.skip(true, 'No agents — cannot verify columns');
      return;
    }

    // Verify column headers are present
    const headers = table.locator('thead th');
    const headerTexts = await headers.allTextContents();
    const normalized = headerTexts.map((t) => t.trim().toLowerCase());

    expect(normalized).toContain('role');
    expect(normalized).toContain('name');
    expect(normalized).toContain('model');
    expect(normalized).toContain('agent id');
    expect(normalized).toContain('version');
  });

  test('E2E-AGENT-006: DELETE /api/agents/:id without session returns 401', async ({ request }) => {
    const res = await request.delete('/api/agents/nonexistent-id');
    expect(res.status()).toBe(401);
  });

  // E2E-AGENT-007 and E2E-AGENT-008 skipped — delete tests modify real Anthropic state
});

test.describe('Agent detail view', () => {
  test('E2E-AGENT-009: click agent name navigates to /agents/[id] showing detail fields', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    const emptyState = page.getByText('No agents configured');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      test.skip(true, 'No agents — cannot test detail navigation');
      return;
    }

    // Click the first agent name link
    const firstNameLink = table.locator('tbody tr').first().locator('a').first();
    await expect(firstNameLink).toBeVisible({ timeout: 5_000 });
    const agentName = await firstNameLink.textContent();
    await firstNameLink.click();

    // Should navigate to an agent detail page
    await expect(page).toHaveURL(/\/agents\/.+/, { timeout: 10_000 });

    // Detail page should show the agent name as h1
    await expect(page.getByRole('heading', { name: agentName!.trim() })).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-AGENT-010: navigate to /agents/nonexistent-id shows "Agent not found"', async ({ authedPage: page }) => {
    await page.goto('/agents/nonexistent-id');

    await expect(page.getByText('Agent not found')).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-AGENT-011: back link on detail page returns to /agents', async ({ authedPage: page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    const emptyState = page.getByText('No agents configured');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      test.skip(true, 'No agents — cannot test back link');
      return;
    }

    // Navigate to first agent detail
    const firstNameLink = table.locator('tbody tr').first().locator('a').first();
    await firstNameLink.click();
    await expect(page).toHaveURL(/\/agents\/.+/, { timeout: 10_000 });

    // Click the "Agents" back link
    const backLink = page.getByRole('link', { name: 'Agents' }).first();
    await expect(backLink).toBeVisible({ timeout: 5_000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/agents$/, { timeout: 10_000 });
  });
});
