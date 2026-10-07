import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { requireProductManager } from '@/lib/auth/authorization';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const movements = await database.collection('stockMovements').find({})
      .sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json(movements.map((movement) => ({
      id: String(movement._id),
      productName: movement.productName,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
    })));
  } catch (error) {
    console.error('Failed to load stock history:', error);
    return NextResponse.json({ error: 'Unable to load stock history.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json();
    if (!body || typeof body.productId !== 'string' || !ObjectId.isValid(body.productId) ||
        !['ADD', 'REMOVE', 'SET'].includes(body.type) || typeof body.quantity !== 'number' ||
        !Number.isInteger(body.quantity) || body.quantity < 0 ||
        typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 300 ||
        (body.type !== 'SET' && body.quantity === 0)) {
      return NextResponse.json({ error: 'Provide a product, valid adjustment type, quantity, and reason.' }, { status: 400 });
    }
    const database = await connectDatabase();
    const productId = new ObjectId(body.productId);
    const product = await database.collection('products').findOne({ _id: productId, isActive: true });
    if (!product) return NextResponse.json({ error: 'Active product not found.' }, { status: 404 });
    const nextStock = body.type === 'SET'
      ? body.quantity
      : product.currentStock + (body.type === 'ADD' ? body.quantity : -body.quantity);
    if (nextStock < 0) return NextResponse.json({ error: 'Adjustment cannot make stock negative.' }, { status: 400 });
    const now = new Date();
    const session = database.client.startSession();
    try {
      session.startTransaction();
      const update = await database.collection('products').updateOne(
        { _id: productId, isActive: true, currentStock: product.currentStock },
        { $set: { currentStock: nextStock, updatedAt: now } },
        { session }
      );
      if (!update.modifiedCount) {
        await session.abortTransaction();
        return NextResponse.json({ error: 'Stock changed concurrently. Reload and try again.' }, { status: 409 });
      }
      const movement = {
        productId, productName: product.productName, type: body.type,
        quantity: body.type === 'SET' ? nextStock - product.currentStock : body.type === 'ADD' ? body.quantity : -body.quantity,
        previousStock: product.currentStock, currentStock: nextStock,
        reason: body.reason.trim(), createdBy: new ObjectId(user.id), createdAt: now,
      };
      await database.collection('stockMovements').insertOne(movement, { session });
      await session.commitTransaction();
      return NextResponse.json({ id: 'recorded', ...movement }, { status: 201 });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    return NextResponse.json({ error: 'Unable to adjust stock.' }, { status: 503 });
  }
}
