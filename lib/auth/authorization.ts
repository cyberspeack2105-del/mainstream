import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';

export async function requireProductManager(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Owner or manager access is required to change products.' },
      { status: 403 }
    );
  }
  return user;
}
