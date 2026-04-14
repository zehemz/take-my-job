import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

const GITHUB_LOGIN_RE = /^[a-z0-9-]{1,39}$/i;

function getAllowedUsers(): Set<string> {
  const raw = process.env.ALLOWED_GITHUB_USERS ?? '';
  const users = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
  if (users.length === 0) {
    throw new Error(
      '[kobani] ALLOWED_GITHUB_USERS is not set or empty. ' +
      'Set it to a comma-separated list of GitHub usernames in your .env file.'
    );
  }
  return new Set(users);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({ authorization: { params: { scope: 'read:user' } } }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24h — do NOT use 30d default
  callbacks: {
    signIn({ profile }) {
      const login = (profile?.login as string | undefined) ?? '';
      if (!GITHUB_LOGIN_RE.test(login)) return false;
      const allowed = getAllowedUsers(); // reads fresh from env on every sign-in
      return allowed.has(login.toLowerCase());
    },
    jwt({ token, profile }) {
      if (profile) {
        token.githubUsername = profile.login as string;
        token.avatarUrl = (profile.avatar_url ?? profile.image) as string;
      }
      return token;
    },
    session({ session, token }) {
      session.user.githubUsername = token.githubUsername as string;
      session.user.avatarUrl = token.avatarUrl as string;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/unauthorized' },
});
