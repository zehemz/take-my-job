import { auth } from '@/auth';

type Session = Awaited<ReturnType<typeof auth>>;

const DEV_SESSION: Session = {
  user: {
    name: 'Dev User',
    email: 'dev@localhost',
    githubUsername: 'dev',
    avatarUrl: '',
  },
  expires: '9999-01-01T00:00:00.000Z',
};

/**
 * Drop-in replacement for `auth()` in API route handlers.
 * When DEV_AUTH_BYPASS=true, returns a fake session so OAuth is not required locally.
 */
export async function devAuth(): Promise<Session> {
  if (process.env.DEV_AUTH_BYPASS === 'true') return DEV_SESSION;
  return auth();
}
