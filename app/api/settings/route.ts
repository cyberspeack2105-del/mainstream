import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db/mongodb';
import { requireProductManager } from '@/lib/auth/authorization';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

type ShopSettingsDocument = {
  _id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  upiId: string;
  updatedAt?: Date;
  updatedBy?: string;
};

const defaults = {
  name: 'MAIN STREAM ELECTRONICS',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  upiId: '',
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const saved = await database.collection<ShopSettingsDocument>('shopSettings').findOne({ _id: 'profile' });
    return NextResponse.json({ ...defaults, ...saved, _id: undefined });
  } catch (error) {
    console.error('Failed to load shop settings:', error);
    return NextResponse.json({ error: 'Unable to load shop settings.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Provide valid shop settings.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const fields = ['name', 'address', 'phone', 'email', 'gstin', 'upiId'] as const;
    if (!fields.every((field) => typeof input[field] === 'string' && input[field].length <= 500)) {
      return NextResponse.json({ error: 'Shop settings must be text values under 500 characters.' }, { status: 400 });
    }
    const settings = Object.fromEntries(fields.map((field) => [field, (input[field] as string).trim()]));
    if (!settings.name || (settings.upiId && !/^[\w.-]+@[\w.-]+$/.test(settings.upiId))) {
      return NextResponse.json({ error: 'Enter a shop name and a valid UPI ID.' }, { status: 400 });
    }

    const database = await connectDatabase();
    await database.collection<ShopSettingsDocument>('shopSettings').updateOne(
      { _id: 'profile' },
      { $set: { ...settings, updatedAt: new Date(), updatedBy: user.id } },
      { upsert: true }
    );
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to save shop settings:', error);
    return NextResponse.json({ error: 'Unable to save shop settings.' }, { status: 503 });
  }
}
