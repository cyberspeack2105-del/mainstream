import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  deleteSession,
  readSignedSessionId,
  SESSION_COOKIE,
} from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const cookieSessionId = readSignedSessionId(request.cookies.get(SESSION_COOKIE)?.value);
  const authorization = request.headers.get('authorization');
  const bearerToken = request.headers.get('x-mse-client') === 'flutter' && authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;
  const sessionId = cookieSessionId ?? readSignedSessionId(bearerToken);
  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to revoke session during logout:', error);
      clearSessionCookie(response);
      return NextResponse.json(
        { error: 'Could not revoke the server session. Please retry when the database is available.' },
        { status: 503, headers: response.headers }
      );
    }
  }
  clearSessionCookie(response);
  return response;
}
