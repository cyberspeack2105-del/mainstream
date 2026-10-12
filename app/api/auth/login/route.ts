import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db/mongodb';
import { createMobileSessionToken, createSession, setSessionCookie, toSafeUser } from '@/lib/auth/session';
import type { UserDocument } from '@/lib/auth/types';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attemptsByAddress = new Map<string, { count: number; resetAt: number }>();
let dummyPasswordHash: Promise<string> | undefined;

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
};

function getAttemptAddress(request: NextRequest): string {
  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(address: string): boolean {
  const now = Date.now();
  const entry = attemptsByAddress.get(address);
  if (!entry || entry.resetAt <= now) {
    attemptsByAddress.set(address, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(address: string): void {
  const now = Date.now();
  const entry = attemptsByAddress.get(address);
  if (!entry || entry.resetAt <= now) {
    attemptsByAddress.set(address, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const address = getAttemptAddress(request);
  if (isRateLimited(address)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  if (
    typeof body.identifier !== 'string' ||
    typeof body.password !== 'string' ||
    body.identifier.trim().length < 1 ||
    body.identifier.length > 254 ||
    body.password.length < 1 ||
    body.password.length > 128
  ) {
    return NextResponse.json({ error: 'Enter a valid username/email and password.' }, { status: 400 });
  }

  try {
    const database = await connectDatabase();
    const identifier = body.identifier.trim().toLowerCase();
    const user = await database.collection<UserDocument>('users').findOne({
      isActive: true,
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!dummyPasswordHash) {
      dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
    }
    const passwordMatches = await bcrypt.compare(
      body.password,
      user?.passwordHash ?? (await dummyPasswordHash)
    );

    if (!user || !passwordMatches) {
      recordFailedAttempt(address);
      return NextResponse.json({ error: 'Invalid username/email or password.' }, { status: 401 });
    }

    attemptsByAddress.delete(address);
    const session = await createSession(user._id);
    const responseBody: { user: ReturnType<typeof toSafeUser>; accessToken?: string } = {
      user: toSafeUser(user),
    };
    if (request.headers.get('x-mse-client') === 'flutter') {
      responseBody.accessToken = createMobileSessionToken(session._id);
    }
    const response = NextResponse.json(responseBody);
    setSessionCookie(response, session._id);
    return response;
  } catch (error) {
    console.error('Login request failed:', error);
    return NextResponse.json({ error: 'Unable to sign in. Check the database connection.' }, { status: 503 });
  }
}
