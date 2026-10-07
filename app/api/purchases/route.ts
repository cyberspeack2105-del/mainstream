import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { requireProductManager } from '@/lib/auth/authorization';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

type PurchaseBody = {
  supplierId?: unknown;
  invoiceNumber?: unknown;
  items?: unknown;
  paidAmount?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const purchases = await database.collection('purchases').find({}).sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json(purchases.map((purchase) => ({ ...purchase, id: String(purchase._id), _id: undefined })));
  } catch (error) {
    console.error('Failed to load purchases:', error);
    return NextResponse.json({ error: 'Unable to load purchases.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    let body: PurchaseBody;
    try {
      body = (await request.json()) as PurchaseBody;
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (
      typeof body.supplierId !== 'string' || !ObjectId.isValid(body.supplierId) ||
      typeof body.invoiceNumber !== 'string' || !body.invoiceNumber.trim() ||
      !Array.isArray(body.items) || !body.items.length || body.items.length > 100 ||
      typeof body.paidAmount !== 'number' || !Number.isFinite(body.paidAmount) || body.paidAmount < 0
    ) return NextResponse.json({ error: 'Enter supplier, invoice number, items, and a valid paid amount.' }, { status: 400 });

    const items = body.items as Array<Record<string, unknown>>;
    if (!items.every((item) =>
      typeof item.productId === 'string' && ObjectId.isValid(item.productId) &&
      typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0 &&
      typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice) && item.purchasePrice >= 0 &&
      typeof item.gstRate === 'number' && Number.isFinite(item.gstRate) && item.gstRate >= 0 && item.gstRate <= 100
    )) return NextResponse.json({ error: 'Each purchase item needs a product, whole-number quantity, non-negative price, and valid GST.' }, { status: 400 });

    const database = await connectDatabase();
    const supplierId = new ObjectId(body.supplierId);
    const supplier = await database.collection('suppliers').findOne({ _id: supplierId, isActive: true });
    if (!supplier) return NextResponse.json({ error: 'Active supplier not found.' }, { status: 404 });
    const productIds = items.map((item) => new ObjectId(item.productId as string));
    if (new Set(productIds.map(String)).size !== productIds.length) {
      return NextResponse.json({ error: 'Each product may appear once per purchase. Combine duplicate lines.' }, { status: 400 });
    }
    const products = await database.collection('products').find({ _id: { $in: productIds }, isActive: true }).toArray();
    if (products.length !== items.length) return NextResponse.json({ error: 'One or more active products were not found.' }, { status: 404 });
    const byId = new Map(products.map((product) => [String(product._id), product]));
    const purchaseItems = items.map((item) => {
      const product = byId.get(String(item.productId));
      if (!product) throw new Error('Product lookup mismatch.');
      return {
        productId: new ObjectId(item.productId as string),
        productName: product.productName,
        quantity: item.quantity as number,
        purchasePrice: item.purchasePrice as number,
        gstRate: item.gstRate as number,
        total: (item.quantity as number) * (item.purchasePrice as number),
      };
    });
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const gstAmount = purchaseItems.reduce((sum, item) => sum + item.total * item.gstRate / 100, 0);
    const grandTotal = subtotal + gstAmount;
    if (body.paidAmount > grandTotal) return NextResponse.json({ error: 'Paid amount cannot exceed the invoice total.' }, { status: 400 });
    const now = new Date();
    const purchase = {
      supplierId,
      supplierName: supplier.name,
      invoiceNumber: body.invoiceNumber.trim().slice(0, 100),
      date: now,
      items: purchaseItems,
      subtotal,
      gstAmount,
      grandTotal,
      paidAmount: body.paidAmount,
      balanceAmount: grandTotal - body.paidAmount,
      status: 'Received',
      createdBy: new ObjectId(user.id),
      createdAt: now,
    };
    const session = database.client.startSession();
    try {
      session.startTransaction();
      const updateResult = await database.collection('products').bulkWrite(
        purchaseItems.map((item) => ({
          updateOne: {
            filter: { _id: item.productId, isActive: true },
            update: { $inc: { currentStock: item.quantity }, $set: { updatedAt: now } },
          },
        })),
        { session, ordered: true }
      );
      if (updateResult.matchedCount !== purchaseItems.length) {
        throw new Error('A product changed while the purchase was being recorded.');
      }
      const inserted = await database.collection('purchases').insertOne(purchase, { session });
      await database.collection('stockMovements').insertMany(purchaseItems.map((item) => ({
        productId: item.productId, productName: item.productName, type: 'PURCHASE',
        quantity: item.quantity, reason: `Purchase invoice ${purchase.invoiceNumber}`,
        referenceId: inserted.insertedId, createdBy: new ObjectId(user.id), createdAt: now,
      })), { session, ordered: true });
      await session.commitTransaction();
      return NextResponse.json({ id: inserted.insertedId.toHexString(), ...purchase }, { status: 201 });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Failed to record purchase:', error);
    return NextResponse.json({ error: 'Unable to record purchase and update stock.' }, { status: 503 });
  }
}
