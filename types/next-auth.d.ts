import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubUsername: string;
      avatarUrl: string;
      isAdmin: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    githubUsername?: string | null;
    avatarUrl?: string | null;
    isAdmin?: boolean;
  }
}
