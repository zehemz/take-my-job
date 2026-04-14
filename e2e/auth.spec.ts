import { test, expect } from '@playwright/test';

/**
 * Auth flows — E2E-AUTH-*
 * These tests do NOT use the authedPage fixture; they verify the unauthenticated path.
 */
test.describe('Auth flows', () => {
  test('E2E-AUTH-001: unauthenticated visit redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('E2E-AUTH-002: login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to continue')).toBeVisible();
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
  });

  test('E2E-AUTH-003: logo image loads on login page', async ({ page }) => {
    await page.goto('/login');
    const img = page.locator('img').first();
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('E2E-AUTH-005: unauthorized page shows neutral copy without mentioning GitHub', async ({ page }) => {
    await page.goto('/unauthorized');
    await expect(page.getByText('Access denied')).toBeVisible();
    await expect(page.getByText(/Contact your team admin/)).toBeVisible();
    const content = await page.textContent('body');
    expect(content).not.toContain('GitHub');
    expect(page.url()).not.toContain('username=');
  });

  test('E2E-AUTH-006: direct API call without session returns 401 JSON', async ({ request }) => {
    const res = await request.get('/api/boards');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  test('E2E-AUTH-007: open-redirect callbackUrl=//evil.com is sanitised', async ({ page }) => {
    await page.goto('/login?callbackUrl=//evil.com');
    // The server sanitises //evil.com → / before passing it to signIn.
    // The query string may still contain "evil.com" as a value — that's fine.
    // What matters: the browser is NOT navigated off our domain.
    const url = new URL(page.url());
    expect(url.hostname).toBe('localhost');
    // The login page renders normally (not an error, not a redirect off-site)
    await expect(page.getByText('Sign in to continue')).toBeVisible();
  });

  test('E2E-AUTH-008: /api/cards move endpoint without session returns 401', async ({ request }) => {
    const res = await request.post('/api/cards/nonexistent-id/move', {
      data: { columnId: 'nonexistent-column' },
    });
    expect(res.status()).toBe(401);
  });
});
