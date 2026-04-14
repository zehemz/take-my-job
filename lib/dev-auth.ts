import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import type { Session } from 'next-auth';

const DEV_SESSION: Session = {
  user: {
    name: 'Dev User',
    email: 'dev@localhost',
    githubUsername: 'dev',
    avatarUrl: '',
    isAdmin: true,
  },
  expires: '9999-01-01T00:00:00.000Z',
};

let devUserSeeded = false;

export async function devAuth(): Promise<Session | null> {
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    if (!devUserSeeded) {
      await prisma.user.upsert({
        where: { githubUsername: 'dev' },
        update: { isAdmin: true },
        create: { githubUsername: 'dev', isAdmin: true },
      });
      devUserSeeded = true;
    }
    return DEV_SESSION;
  }
  return auth() as Promise<Session | null>;
}
