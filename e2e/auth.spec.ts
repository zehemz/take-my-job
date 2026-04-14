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

  test('E2E-AUTH-004: GitHub OAuth button does not contain client_id=undefined', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('github.com/login/oauth')) {
        requests.push(req.url());
      }
    });

    await page.goto('/login');
    // Click the button and wait briefly for navigation attempt
    await page.getByRole('button', { name: /github/i }).click();
    await page.waitForTimeout(1000);

    // If any OAuth redirect happened, it must not contain client_id=undefined
    for (const url of requests) {
      expect(url).not.toContain('client_id=undefined');
    }
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
    // Should stay on our domain — not redirect off-site
    expect(page.url()).not.toMatch(/evil\.com/);
  });

  test('E2E-AUTH-008: /api/cards move endpoint without session returns 401', async ({ request }) => {
    const res = await request.post('/api/cards/nonexistent-id/move', {
      data: { columnId: 'nonexistent-column' },
    });
    expect(res.status()).toBe(401);
  });
});
