import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const records = await database.collection('sales').find({}).sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json(records.map(({ _id, ...record }) => ({ id: String(_id), ...record })));
  } catch (error) {
    console.error('Failed to load sales:', error);
    return NextResponse.json({ error: 'Unable to load sales.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = await request.json();
    if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100 ||
        typeof body.discount !== 'number' || !Number.isFinite(body.discount) || body.discount < 0 ||
        typeof body.paidAmount !== 'number' || !Number.isFinite(body.paidAmount) || body.paidAmount < 0 ||
        (body.paymentMethod !== undefined && !['Cash', 'GPay / QR', 'UPI / QR'].includes(body.paymentMethod)) ||
        (body.paymentReference !== undefined && (typeof body.paymentReference !== 'string' || body.paymentReference.length > 100)) ||
        (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 1000)) ||
        (body.customerName !== undefined && (typeof body.customerName !== 'string' || body.customerName.length > 120)) ||
        (body.customerPhone !== undefined && (typeof body.customerPhone !== 'string' || body.customerPhone.length > 30)) ||
        (body.customerId !== null && body.customerId !== undefined && (typeof body.customerId !== 'string' || !ObjectId.isValid(body.customerId)))) {
      return NextResponse.json({ error: 'Provide bill items and valid discount and paid amounts.' }, { status: 400 });
    }
    const inputs = body.items as Array<Record<string, unknown>>;
    if (!inputs.every((item) => typeof item.productId === 'string' && ObjectId.isValid(item.productId) &&
      typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0)) {
      return NextResponse.json({ error: 'Each bill item needs a product and positive whole-number quantity.' }, { status: 400 });
    }
    const ids = inputs.map((item) => new ObjectId(item.productId as string));
    if (new Set(ids.map(String)).size !== ids.length) return NextResponse.json({ error: 'Duplicate bill items are not allowed.' }, { status: 400 });
    const database = await connectDatabase();
    const products = await database.collection('products').find({ _id: { $in: ids }, isActive: true }).toArray();
    if (products.length !== inputs.length) return NextResponse.json({ error: 'One or more products are no longer available.' }, { status: 404 });
    const byId = new Map(products.map((product) => [String(product._id), product]));
    const items = inputs.map((input) => {
      const product = byId.get(String(input.productId));
      if (!product) throw new Error('Product lookup mismatch.');
      const quantity = input.quantity as number;
      return {
        productId: product._id,
        productName: product.productName,
        sku: product.productCode,
        quantity,
        unitPrice: product.sellingPrice,
        mrp: product.mrp,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate,
        total: product.sellingPrice * quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    if (body.discount > subtotal) return NextResponse.json({ error: 'Discount cannot exceed subtotal.' }, { status: 400 });
    const taxableTotal = subtotal - body.discount;
    const gst = items.reduce((sum, item) => sum + (item.total / Math.max(1, subtotal)) * taxableTotal * item.gstRate / 100, 0);
    const grandTotal = Math.round((taxableTotal + gst) * 100) / 100;
    if (body.paidAmount > grandTotal) return NextResponse.json({ error: 'Paid amount cannot exceed the bill total.' }, { status: 400 });
    const customer = body.customerId
      ? await database.collection('customers').findOne({ _id: new ObjectId(body.customerId), isActive: true })
      : null;
    if (body.customerId && !customer) return NextResponse.json({ error: 'Active customer not found.' }, { status: 404 });
    let saleCustomerId = customer?._id ?? null;
    const customerName = customer?.name ?? (typeof body.customerName === 'string' && body.customerName.trim()
      ? body.customerName.trim()
      : 'Walk-in customer');
    const customerPhone = customer?.phone ?? (typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '');
    const normalizedPhone = customerPhone.replace(/[\s()+-]/g, '');
    if (normalizedPhone && !/^\d{7,15}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Enter a valid customer mobile number.' }, { status: 400 });
    }
    const savedShopProfile = await database.collection<{
      _id: string;
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      gstin?: string;
      upiId?: string;
    }>('shopSettings').findOne({ _id: 'profile' });
    const shopProfile = {
      name: savedShopProfile?.name ?? 'MAIN STREAM ELECTRONICS',
      address: savedShopProfile?.address ?? '',
      phone: savedShopProfile?.phone ?? '',
      email: savedShopProfile?.email ?? '',
      gstin: savedShopProfile?.gstin ?? '',
      upiId: savedShopProfile?.upiId ?? '',
    };
    const now = new Date();
    const orderNumber = `MSE-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const sale = {
      orderNumber,
      invoiceNumber: orderNumber,
      shopProfile,
      customerId: saleCustomerId,
      customerName,
      customerPhone,
      date: now,
      createdAt: now,
      createdBy: new ObjectId(user.id),
      items,
      subtotal,
      discount: body.discount,
      gstAmount: gst,
      grandTotal,
      paidAmount: body.paidAmount,
      balanceAmount: Math.round((grandTotal - body.paidAmount) * 100) / 100,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      orderStatus: 'Completed',
      paymentStatus: body.paidAmount === grandTotal ? 'Paid' : body.paidAmount > 0 ? 'Partially Paid' : 'Credit / Due',
      paymentMethod: body.paymentMethod ?? 'Cash',
      paymentReference: typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '',
      paymentHistory: body.paidAmount > 0 ? [{ id: randomUUID(), date: now, amount: body.paidAmount, method: body.paymentMethod ?? 'Cash' }] : [],
      source: 'POS Counter',
    };
    const session = database.client.startSession();
    try {
      session.startTransaction();
      if (!saleCustomerId && customerName !== 'Walk-in customer' && customerPhone) {
        const activeCustomers = await database.collection('customers')
          .find({ isActive: true }, { session, projection: { _id: 1, phone: 1 } }).toArray();
        const existingCustomer = activeCustomers.find((record) =>
          typeof record.phone === 'string' && record.phone.replace(/\D/g, '') === normalizedPhone
        );
        if (existingCustomer) {
          saleCustomerId = existingCustomer._id;
        } else {
          const newCustomer = await database.collection('customers').insertOne({
            name: customerName,
            phone: customerPhone,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }, { session });
          saleCustomerId = newCustomer.insertedId;
        }
        sale.customerId = saleCustomerId;
      }
      for (const item of items) {
        const result = await database.collection('products').updateOne(
          { _id: item.productId, isActive: true, currentStock: { $gte: item.quantity } },
          { $inc: { currentStock: -item.quantity }, $set: { updatedAt: now } },
          { session }
        );
        if (!result.modifiedCount) throw new Error(`Insufficient stock for ${item.productName}.`);
      }
      const inserted = await database.collection('sales').insertOne(sale, { session });
      if (body.paidAmount > 0) {
        await database.collection('payments').insertOne({
          saleId: inserted.insertedId,
          orderNumber,
          customerId: sale.customerId,
          amount: body.paidAmount,
          method: sale.paymentMethod,
          reference: sale.paymentReference,
          notes: sale.notes,
          createdBy: new ObjectId(user.id),
          createdAt: now,
        }, { session });
      }
      await database.collection('stockMovements').insertMany(items.map((item) => ({
        productId: item.productId, productName: item.productName, type: 'SALE',
        quantity: -item.quantity, reason: `Sale invoice ${orderNumber}`,
        referenceId: inserted.insertedId, createdBy: new ObjectId(user.id), createdAt: now,
      })), { session });
      await session.commitTransaction();
      return NextResponse.json({ id: inserted.insertedId.toHexString(), ...sale }, { status: 201 });
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof Error && error.message.startsWith('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Failed to complete sale:', error);
    return NextResponse.json({ error: 'Unable to complete sale and update inventory.' }, { status: 503 });
  }
}
