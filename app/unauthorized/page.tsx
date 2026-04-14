export const metadata = {
  title: 'Access restricted — Kobani',
};

export default function UnauthorizedPage() {
  return (
    <div className="bg-zinc-950 min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm shadow-2xl text-center">
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">Access denied</h1>
        <p className="text-sm text-zinc-500 mb-8">
          Contact your team admin to request access.
        </p>
        <a
          href="/login"
          className="inline-flex items-center justify-center w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
