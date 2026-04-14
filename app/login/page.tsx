export const dynamic = 'force-dynamic';

import Image from 'next/image';
import GitHubSignInButton from '@/app/_components/GitHubSignInButton';

export const metadata = {
  title: 'Sign in — Kobani',
};

interface Props {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  // Validate callbackUrl: only accept paths starting with / but NOT //
  const raw = params.callbackUrl;
  const callbackUrl =
    raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  const error = params.error;

  return (
    <div className="bg-zinc-950 min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm shadow-2xl">
        {/* Logo + wordmark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Image src="/logo.png" alt="Kobani" width={32} height={34} />
          <span className="text-2xl font-semibold text-zinc-100">Kobani</span>
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">Sign in to continue</h1>
          <p className="text-sm text-zinc-500 mt-1">Your AI-powered workspace</p>
        </div>

        {/* Error bar */}
        {error === 'AccessDenied' && (
          <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            Access denied. Contact your team admin.
          </div>
        )}

        {/* GitHub sign-in button (client component) */}
        <GitHubSignInButton callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
