import { auth } from './auth';
import { NextResponse, type NextRequest } from 'next/server';

const authMiddleware = auth((req) => {
  if (!req.auth) {
    const isApi = req.nextUrl.pathname.startsWith('/api/');
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    // Validate callbackUrl: only accept same-origin relative paths
    const raw = req.nextUrl.pathname;
    const safeCallback = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    loginUrl.searchParams.set('callbackUrl', safeCallback);
    return NextResponse.redirect(loginUrl);
  }
});

export default function middleware(req: NextRequest) {
  // Check at runtime, not build time — a module-level ternary would bake
  // the dev bypass into the production bundle if the build env has the flag.
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    return NextResponse.next();
  }
  return authMiddleware(req, {} as any);
}

export const config = {
  matcher: [
    '/((?!login$|unauthorized$|api/auth(?:/|$)|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)$).*)',
  ],
};
