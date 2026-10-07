import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

type SaleDocument = {
  _id: ObjectId;
  orderNumber?: string;
  customerId?: ObjectId | null;
  balanceAmount: number;
  paidAmount: number;
  paymentHistory?: Array<{ id: string; date: Date; amount: number; method: string }>;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const records = await database.collection('sales').find({ balanceAmount: { $gt: 0 } })
      .sort({ createdAt: 1 }).limit(500).toArray();
    return NextResponse.json(records.map(({ _id, ...sale }) => ({ id: String(_id), ...sale })));
  } catch (error) {
    console.error('Failed to load outstanding balances:', error);
    return NextResponse.json({ error: 'Unable to load due records.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = await request.json();
    if (!body || typeof body.saleId !== 'string' || !ObjectId.isValid(body.saleId) ||
      typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 ||
      !['Cash', 'GPay / QR', 'UPI / QR'].includes(body.method)) {
      return NextResponse.json({ error: 'Provide a sale, positive payment amount, and valid method.' }, { status: 400 });
    }
    const database = await connectDatabase();
    const now = new Date();
    const saleId = new ObjectId(body.saleId);
    const session = database.client.startSession();
    try {
      session.startTransaction();
      const sale = await database.collection<SaleDocument>('sales').findOne({ _id: saleId }, { session });
      if (!sale || sale.balanceAmount <= 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: 'Outstanding sale not found.' }, { status: 404 });
      }
      if (body.amount > sale.balanceAmount) {
        await session.abortTransaction();
        return NextResponse.json({ error: 'Payment cannot exceed the outstanding balance.' }, { status: 400 });
      }
      const balanceAmount = Math.round((sale.balanceAmount - body.amount) * 100) / 100;
      const paidAmount = Math.round((sale.paidAmount + body.amount) * 100) / 100;
      const update = {
        $set: {
          balanceAmount,
          paidAmount,
          paymentStatus: balanceAmount === 0 ? 'Paid' : 'Partially Paid',
        },
        $push: { paymentHistory: { id: randomUUID(), date: now, amount: body.amount, method: body.method } },
      };
      await database.collection<SaleDocument>('sales').updateOne({ _id: saleId }, update, { session });
      await database.collection('payments').insertOne({
        saleId, orderNumber: sale.orderNumber, customerId: sale.customerId,
        amount: body.amount, method: body.method, createdBy: new ObjectId(user.id), createdAt: now,
      }, { session });
      await session.commitTransaction();
      return NextResponse.json({ paidAmount, balanceAmount, paymentStatus: balanceAmount === 0 ? 'Paid' : 'Partially Paid' });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Failed to record due payment:', error);
    return NextResponse.json({ error: 'Unable to record payment.' }, { status: 503 });
  }
}
