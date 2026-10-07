import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to load current user:', error);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 503 });
  }
}
