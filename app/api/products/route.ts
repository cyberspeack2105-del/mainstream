import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { requireProductManager } from '@/lib/auth/authorization';
import { toClientProduct, toProductDocument, validateProductInput, type ProductRecord } from '@/lib/products';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const filter: Record<string, unknown> = { isActive: true };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { productName: { $regex: escapedSearch, $options: 'i' } },
        { productCode: { $regex: escapedSearch, $options: 'i' } },
        { category: { $regex: escapedSearch, $options: 'i' } },
        { brand: { $regex: escapedSearch, $options: 'i' } },
        { hsnCode: { $regex: escapedSearch, $options: 'i' } },
      ];
    }
    const products = await database
      .collection<ProductRecord>('products')
      .find(filter)
      .sort({ productName: 1 })
      .limit(1000)
      .toArray();
    return NextResponse.json(products.map(toClientProduct));
  } catch (error) {
    console.error('Failed to load products:', error);
    return NextResponse.json({ error: 'Unable to load products' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
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
    const now = new Date();
    const document = {
      ...toProductDocument(body),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: new ObjectId(user.id),
    };
    const result = await database.collection('products').insertOne(document);
    return NextResponse.json(
      toClientProduct({ ...document, _id: result.insertedId } as ProductRecord),
      { status: 201 }
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'That product code already exists.' }, { status: 409 });
    }
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Unable to save product' }, { status: 503 });
  }
}
