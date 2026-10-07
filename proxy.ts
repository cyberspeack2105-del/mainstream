import { NextRequest, NextResponse } from 'next/server';
import {
  findSessionUser,
  readSignedSessionId,
  SESSION_COOKIE,
} from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = readSignedSessionId(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    if (!sessionId) return NextResponse.next();
    try {
      const user = await findSessionUser(sessionId);
      return user
        ? NextResponse.redirect(new URL('/dashboard', request.url))
        : NextResponse.next();
    } catch (error) {
      console.error('Authentication service unavailable while opening login page:', error);
      return NextResponse.json({ error: 'Authentication service is unavailable' }, { status: 503 });
    }
  }

  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') {
    return NextResponse.next();
  }

  if (!sessionId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const user = await findSessionUser(sessionId);
    if (user) return NextResponse.next();
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired. Sign in again.' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    console.error('Authentication service unavailable while protecting a route:', error);
    return NextResponse.json({ error: 'Authentication service is unavailable' }, { status: 503 });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
