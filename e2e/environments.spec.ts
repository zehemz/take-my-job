import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

/**
 * Environment management flows — E2E-ENV-*
 * Tests cover the /environments list page, detail page, inline editing, and delete confirmation.
 */

test.describe('Environments — List & Delete', () => {
  test('E2E-ENV-001: navigate to /environments renders table with Name, Network, ID columns', async ({ authedPage: page }) => {
    await page.goto('/environments');
    await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible({ timeout: 10_000 });

    // Wait for loading to finish — table or empty state should appear
    const table = page.locator('table');
    const emptyState = page.getByText('No environments found');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      // Empty state is valid — verify it renders
      await expect(emptyState).toBeVisible();
      return;
    }

    // Verify column headers
    const headers = table.locator('thead th');
    const headerTexts = await headers.allTextContents();
    const normalized = headerTexts.map((t) => t.trim().toLowerCase());

    expect(normalized).toContain('name');
    expect(normalized).toContain('network');
    expect(normalized).toContain('id');

    // At least one data row visible
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });
  });

  test('E2E-ENV-002: click Delete on an environment row shows inline confirmation', async ({
    authedPage: page,
    request,
    cookieHeader,
  }) => {
    const api = new KobaniApi(request, cookieHeader);
    const name = `E2E Delete Test ${Date.now()}`;
    let envId: string | undefined;

    try {
      // Create a test environment via API
      const created = await api.createEnvironment({ name });
      envId = created.id;

      await page.goto('/environments');
      await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible({ timeout: 10_000 });

      const table = page.locator('table');
      await expect(table).toBeVisible({ timeout: 10_000 });

      // Find the row with our test environment
      const row = table.locator('tbody tr', { has: page.getByText(name) });
      await expect(row).toBeVisible({ timeout: 5_000 });

      // Click Delete button
      await row.getByRole('button', { name: 'Delete' }).click();

      // Expect confirmation UI: "Confirm?" text and Yes/Cancel buttons
      await expect(row.getByText('Confirm?')).toBeVisible({ timeout: 3_000 });
      await expect(row.getByRole('button', { name: 'Yes' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Cancel' })).toBeVisible();

      // Click Cancel to avoid actually deleting
      await row.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      if (envId) {
        await api.deleteEnvironment(envId).catch(() => {});
      }
    }
  });

  test('E2E-ENV-003: cancel on confirmation step leaves row unchanged', async ({
    authedPage: page,
    request,
    cookieHeader,
  }) => {
    const api = new KobaniApi(request, cookieHeader);
    const name = `E2E Cancel Test ${Date.now()}`;
    let envId: string | undefined;

    try {
      // Create a test environment via API
      const created = await api.createEnvironment({ name });
      envId = created.id;

      await page.goto('/environments');
      await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible({ timeout: 10_000 });

      const table = page.locator('table');
      await expect(table).toBeVisible({ timeout: 10_000 });

      // Find the row with our test environment
      const row = table.locator('tbody tr', { has: page.getByText(name) });
      await expect(row).toBeVisible({ timeout: 5_000 });

      // Click Delete to trigger confirmation
      await row.getByRole('button', { name: 'Delete' }).click();
      await expect(row.getByText('Confirm?')).toBeVisible({ timeout: 3_000 });

      // Click Cancel
      await row.getByRole('button', { name: 'Cancel' }).click();

      // Original Delete button should reappear
      await expect(row.getByRole('button', { name: 'Delete' })).toBeVisible({ timeout: 3_000 });

      // Environment name still visible in row
      await expect(row.getByText(name)).toBeVisible();
    } finally {
      if (envId) {
        await api.deleteEnvironment(envId).catch(() => {});
      }
    }
  });

  // E2E-ENV-004 intentionally skipped — confirming delete permanently archives
  // real Anthropic environments, which is too destructive for E2E.
});

test.describe('Environments — Detail & Edit', () => {
  test('E2E-ENV-005: click environment name in list navigates to /environments/[id] detail page', async ({ authedPage: page }) => {
    await page.goto('/environments');
    await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    const emptyState = page.getByText('No environments found');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const tableVisible = await table.isVisible();
    if (!tableVisible) {
      test.skip(true, 'No environments — cannot test detail navigation');
      return;
    }

    // Click the first environment name link
    const firstNameLink = table.locator('tbody tr').first().locator('a').first();
    await expect(firstNameLink).toBeVisible({ timeout: 5_000 });
    await firstNameLink.click();

    // Should navigate to an environment detail page
    await expect(page).toHaveURL(/\/environments\/.+/, { timeout: 10_000 });

    // Detail page should show the "← Environments" back link (confirms detail page loaded)
    const backLink = page.getByRole('link', { name: /Environments/ });
    await expect(backLink).toBeVisible({ timeout: 10_000 });

    // The Name field label should be visible (rendered via CSS uppercase)
    await expect(page.locator('button[title="Edit name"]')).toBeVisible({ timeout: 5_000 });
  });

  test('E2E-ENV-006: edit environment name, save, and verify update', async ({
    authedPage: page,
    request,
    cookieHeader,
  }) => {
    const api = new KobaniApi(request, cookieHeader);
    const originalName = `E2E Name Edit ${Date.now()}`;
    const updatedName = `E2E Name Updated ${Date.now()}`;
    let envId: string | undefined;

    try {
      // Create a test environment via API
      const created = await api.createEnvironment({ name: originalName });
      envId = created.id;

      // Navigate to the detail page
      await page.goto(`/environments/${envId}`);

      // Wait for the page to load (back link as indicator)
      const backLink = page.getByRole('link', { name: /Environments/ });
      await expect(backLink).toBeVisible({ timeout: 10_000 });

      // Verify original name is displayed
      await expect(page.getByText(originalName)).toBeVisible({ timeout: 5_000 });

      // Click the pencil/edit icon for the Name field
      await page.locator('button[title="Edit name"]').click();

      // Clear the input and type the new name
      const nameInput = page.locator('input[type="text"]');
      await expect(nameInput).toBeVisible({ timeout: 3_000 });
      await nameInput.fill(updatedName);

      // Click Save
      await page.getByRole('button', { name: 'Save' }).click();

      // Wait for save to complete — the updated name should appear
      await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });

      // The edit input should be gone (back to read mode)
      await expect(nameInput).not.toBeVisible({ timeout: 5_000 });
    } finally {
      if (envId) {
        await api.deleteEnvironment(envId).catch(() => {});
      }
    }
  });

  test('E2E-ENV-007: edit description, save, and verify update', async ({
    authedPage: page,
    request,
    cookieHeader,
  }) => {
    const api = new KobaniApi(request, cookieHeader);
    const name = `E2E Desc Edit ${Date.now()}`;
    const newDescription = `Updated description for E2E test at ${Date.now()}`;
    let envId: string | undefined;

    try {
      // Create a test environment via API
      const created = await api.createEnvironment({ name });
      envId = created.id;

      // Navigate to the detail page
      await page.goto(`/environments/${envId}`);

      // Wait for the page to load
      const backLink = page.getByRole('link', { name: /Environments/ });
      await expect(backLink).toBeVisible({ timeout: 10_000 });

      // Click the pencil/edit icon for the Description field
      await page.locator('button[title="Edit description"]').click();

      // Find the textarea and type the new description
      const descTextarea = page.locator('textarea');
      await expect(descTextarea).toBeVisible({ timeout: 3_000 });
      await descTextarea.fill(newDescription);

      // Click Save
      await page.getByRole('button', { name: 'Save' }).click();

      // Wait for save to complete — the updated description should appear
      await expect(page.getByText(newDescription)).toBeVisible({ timeout: 10_000 });

      // The textarea should be gone (back to read mode)
      await expect(descTextarea).not.toBeVisible({ timeout: 5_000 });
    } finally {
      if (envId) {
        await api.deleteEnvironment(envId).catch(() => {});
      }
    }
  });

  // E2E-ENV-008 (network switch) skipped — complex UI interaction, left as planned
  // E2E-ENV-009 (packages edit) skipped — complex UI interaction, left as planned

  test('E2E-ENV-010: navigate to /environments/nonexistent-id shows error or not found', async ({ authedPage: page }) => {
    await page.goto('/environments/nonexistent-id-12345');

    // The detail page shows either "Environment not found" or a generic error
    const notFound = page.getByText('Environment not found');
    const errorState = page.getByText('Failed to load environment');
    await expect(notFound.or(errorState)).toBeVisible({ timeout: 10_000 });
  });
});
