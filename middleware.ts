import { auth } from './auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
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

export const config = {
  matcher: [
    '/((?!login$|unauthorized$|api/auth(?:/|$)|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
