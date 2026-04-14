import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

const GITHUB_LOGIN_RE = /^[a-z0-9-]{1,39}$/i;

// Lazy-import prisma to avoid loading it in Edge Runtime (middleware).
// The signIn and jwt callbacks only run server-side, not in the edge middleware.
async function getPrisma() {
  const { prisma } = await import('@/lib/db');
  return prisma;
}

if (process.env.ALLOWED_GITHUB_USERS?.trim()) {
  console.warn(
    '[kobani] ALLOWED_GITHUB_USERS is set but RBAC is now active. ' +
    'This env var is ignored. Manage access via the admin UI.'
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: { params: { scope: 'read:user' } },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24h — do NOT use 30d default
  callbacks: {
    async signIn({ profile }) {
      const login = (profile?.login as string | undefined) ?? '';
      if (!GITHUB_LOGIN_RE.test(login)) return false;

      const username = login.toLowerCase();

      try {
        const prisma = await getPrisma();

        // Look up user in DB (invite-only: user must exist)
        const user = await prisma.user.findUnique({
          where: { githubUsername: username },
        });

        if (!user) {
          console.warn(`[kobani:auth] sign-in denied: user "${username}" not found in DB`);
          return false;
        }

        // User exists — check group membership (admins always pass)
        if (user.isAdmin) return true;

        const membershipCount = await prisma.userGroupMember.count({
          where: { userId: user.id },
        });

        if (membershipCount === 0) {
          console.warn(`[kobani:auth] sign-in denied: user "${username}" has no group memberships`);
        }

        return membershipCount > 0;
      } catch (err) {
        console.error('[kobani:auth] signIn callback error — allowing sign-in as fallback:', err);
        // If DB is unreachable, allow sign-in to avoid total lockout
        return true;
      }
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.githubUsername = profile.login as string;
        token.avatarUrl = (profile.avatar_url ?? profile.image) as string;
      }
      // Refresh admin status on token refresh (runs server-side only)
      if (token.githubUsername) {
        try {
          const prisma = await getPrisma();
          const dbUser = await prisma.user.findUnique({
            where: { githubUsername: (token.githubUsername as string).toLowerCase() },
            select: { isAdmin: true },
          });
          token.isAdmin = dbUser?.isAdmin ?? false;
        } catch {
          // Edge runtime or DB unavailable — keep existing value
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.githubUsername = token.githubUsername as string;
      session.user.avatarUrl = token.avatarUrl as string;
      session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/unauthorized' },
});
