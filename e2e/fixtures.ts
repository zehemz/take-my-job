import { test as base, expect, type Page } from '@playwright/test';
import { encode } from '@auth/core/jwt';

// NextAuth v5 uses the cookie name as the HKDF salt for key derivation
const COOKIE_NAME = 'authjs.session-token';

export type AuthFixtures = {
  authedPage: Page;
  cookieHeader: string;
};

/**
 * Creates a signed+encrypted session cookie that NextAuth v5 accepts.
 * Uses the same `@auth/core/jwt` encode function as NextAuth itself,
 * so the token format is guaranteed to match.
 */
export async function createTestSessionCookie(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set. Add it to .env.local before running E2E tests.',
    );
  }
  return encode({
    token: {
      githubUsername: process.env.TEST_GITHUB_USERNAME ?? 'testuser',
      avatarUrl: '',
      name: 'Test User',
      email: 'test@example.com',
      sub: 'e2e-test-user-id',
    },
    secret,
    salt: COOKIE_NAME,
    maxAge: 86400,
  });
}

/**
 * `authedPage` — a Playwright Page pre-loaded with a valid session cookie.
 * `cookieHeader` — the raw Cookie header string for use in APIRequestContext calls.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *   test('my test', async ({ authedPage }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  // Inject a real session cookie so NextAuth middleware passes
  authedPage: async ({ page }, use) => {
    const token = await createTestSessionCookie();

    // Must navigate first so the cookie domain is set correctly
    await page.goto('/login');
    await page.context().addCookies([
      {
        name: COOKIE_NAME,
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await use(page);
  },

  // Raw Cookie header for direct API calls via `request` fixture
  cookieHeader: async ({}, use) => {
    const token = await createTestSessionCookie();
    await use(`${COOKIE_NAME}=${token}`);
  },
});

export { expect };
