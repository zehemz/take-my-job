'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-zinc-400 text-sm">{error.message || 'Something went wrong.'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg border border-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
