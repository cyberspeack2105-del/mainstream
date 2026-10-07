import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import type { SafeUser, SessionDocument, UserDocument } from '@/lib/auth/types';

export const SESSION_COOKIE = 'mse_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function signSessionId(sessionId: string): string {
  return createHmac('sha256', getSessionSecret()).update(sessionId).digest('hex');
}

export function readSignedSessionId(token: string | undefined): string | null {
  if (!token) return null;
  const [sessionId, providedSignature, extra] = token.split('.');
  if (
    extra !== undefined ||
    !/^[a-f0-9]{64}$/i.test(sessionId ?? '') ||
    !/^[a-f0-9]{64}$/i.test(providedSignature ?? '')
  ) {
    return null;
  }

  const expected = Buffer.from(signSessionId(sessionId), 'hex');
  const actual = Buffer.from(providedSignature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? sessionId : null;
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE, `${sessionId}.${signSessionId(sessionId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function createSession(userId: ObjectId): Promise<SessionDocument> {
  const database = await connectDatabase();
  const session: SessionDocument = {
    _id: randomBytes(32).toString('hex'),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    createdAt: new Date(),
  };
  await database.collection<SessionDocument>('sessions').insertOne(session);
  return session;
}

export async function findSessionUser(sessionId: string): Promise<SafeUser | null> {
  const database = await connectDatabase();
  const session = await database.collection<SessionDocument>('sessions').findOne({
    _id: sessionId,
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  const user = await database.collection<UserDocument>('users').findOne({
    _id: session.userId,
    isActive: true,
  });
  return user ? toSafeUser(user) : null;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<SafeUser | null> {
  const sessionId = readSignedSessionId(request.cookies.get(SESSION_COOKIE)?.value);
  return sessionId ? findSessionUser(sessionId) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = await connectDatabase();
  await database.collection<SessionDocument>('sessions').deleteOne({ _id: sessionId });
}

export function toSafeUser(user: UserDocument): SafeUser {
  return {
    id: user._id.toHexString(),
    email: user.email ?? null,
    username: user.username,
    role: user.role,
  };
}
