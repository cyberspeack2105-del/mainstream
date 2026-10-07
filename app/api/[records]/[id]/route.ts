import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { requireProductManager } from '@/lib/auth/authorization';
import { normalizeShopRecord, type ShopRecordDocument, type ShopRecordKind } from '@/lib/shop-records';

export const runtime = 'nodejs';

function resolveKind(value: string): ShopRecordKind | null {
  return value === 'customers' || value === 'suppliers' ? value : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ records: string; id: string }> }
) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const { records, id } = await context.params;
    const kind = resolveKind(records);
    if (!kind) return NextResponse.json({ error: 'Unknown records collection.' }, { status: 404 });
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid record id.' }, { status: 400 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    const normalized = normalizeShopRecord(kind, body);
    if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const database = await connectDatabase();
    const result = await database.collection<ShopRecordDocument>(kind).findOneAndUpdate(
      { _id: new ObjectId(id), isActive: true },
      { $set: { ...normalized.value, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    return NextResponse.json({
      id: result._id.toHexString(),
      ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== '_id' && key !== 'isActive')),
    });
  } catch (error) {
    console.error('Failed to update shop record:', error);
    return NextResponse.json({ error: 'Unable to update record.' }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ records: string; id: string }> }
) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const { records, id } = await context.params;
    const kind = resolveKind(records);
    if (!kind) return NextResponse.json({ error: 'Unknown records collection.' }, { status: 404 });
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid record id.' }, { status: 400 });
    const database = await connectDatabase();
    const result = await database.collection<ShopRecordDocument>(kind).updateOne(
      { _id: new ObjectId(id), isActive: true },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to deactivate shop record:', error);
    return NextResponse.json({ error: 'Unable to deactivate record.' }, { status: 503 });
  }
}
