import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { requireProductManager } from '@/lib/auth/authorization';
import { toClientProduct, toProductDocument, validateProductInput, type ProductRecord } from '@/lib/products';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }
    const database = await connectDatabase();
    const product = await database.collection<ProductRecord>('products').findOne({
      _id: new ObjectId(id),
      isActive: true,
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json(toClientProduct(product));
  } catch (error) {
    console.error('Failed to load product:', error);
    return NextResponse.json({ error: 'Unable to load product' }, { status: 503 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (!validateProductInput(body)) {
      return NextResponse.json({ error: 'Check product fields and non-negative prices/stock.' }, { status: 400 });
    }
    const database = await connectDatabase();
    const result = await database.collection<ProductRecord>('products').findOneAndUpdate(
      { _id: new ObjectId(id), isActive: true },
      { $set: { ...toProductDocument(body), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json(toClientProduct(result));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'That product code already exists.' }, { status: 409 });
    }
    console.error('Failed to update product:', error);
    return NextResponse.json({ error: 'Unable to update product' }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }
    const database = await connectDatabase();
    const result = await database.collection<ProductRecord>('products').updateOne(
      { _id: new ObjectId(id), isActive: true },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to deactivate product:', error);
    return NextResponse.json({ error: 'Unable to deactivate product' }, { status: 503 });
  }
}
