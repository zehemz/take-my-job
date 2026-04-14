'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 text-sm">{error.message || 'Something went wrong.'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg border border-zinc-700 transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
