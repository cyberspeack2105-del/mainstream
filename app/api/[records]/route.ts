import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { requireProductManager } from '@/lib/auth/authorization';
import {
  normalizeShopRecord,
  type ShopRecordDocument,
  type ShopRecordKind,
} from '@/lib/shop-records';

export const runtime = 'nodejs';

function resolveKind(value: string): ShopRecordKind | null {
  return value === 'customers' || value === 'suppliers' ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ records: string }> }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const { records } = await context.params;
    const kind = resolveKind(records);
    if (!kind) return NextResponse.json({ error: 'Unknown records collection.' }, { status: 404 });
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const filter: Record<string, unknown> = { isActive: true };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { gstin: { $regex: escaped, $options: 'i' } },
        { contactPerson: { $regex: escaped, $options: 'i' } },
      ];
    }
    const database = await connectDatabase();
    const result = await database.collection<ShopRecordDocument>(kind)
      .find(filter).sort({ name: 1 }).limit(1000).toArray();
    const billingByCustomer = new Map<string, {
      billCount: number;
      totalBilled: number;
      totalPaid: number;
      totalDue: number;
      latestInvoice: string;
      latestBillDate: Date | null;
    }>();
    if (kind === 'customers' && result.length) {
      const customerIds = result.map((record) => record._id);
      const billing = await database.collection('sales').aggregate<{
        _id: import('mongodb').ObjectId;
        billCount: number;
        totalBilled: number;
        totalPaid: number;
        totalDue: number;
        latestInvoice: string;
        latestBillDate: Date | null;
      }>([
        { $match: { customerId: { $in: customerIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$customerId',
            billCount: { $sum: 1 },
            totalBilled: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            totalDue: { $sum: '$balanceAmount' },
            latestInvoice: { $first: { $ifNull: ['$invoiceNumber', '$orderNumber'] } },
            latestBillDate: { $first: '$createdAt' },
          },
        },
      ]).toArray();
      for (const summary of billing) billingByCustomer.set(summary._id.toHexString(), summary);
    }
    const customerRecords: Array<Record<string, unknown>> = result.map((record) => ({
      id: record._id.toHexString(),
      ...(kind === 'customers' ? {
        billing: billingByCustomer.get(record._id.toHexString()) ?? {
          billCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          latestInvoice: '',
          latestBillDate: null,
        },
      } : {}),
      generatedFromSales: false,
      ...Object.fromEntries(Object.entries(record).filter(([key]) => key !== '_id' && key !== 'isActive')),
    }));

    if (kind === 'customers') {
      const salesCustomers = await database.collection('sales').aggregate<{
        _id: string;
        name: string;
        phone: string;
        billCount: number;
        totalBilled: number;
        totalPaid: number;
        totalDue: number;
        latestInvoice: string;
        latestBillDate: Date | null;
      }>([
        {
          $match: {
            $or: [{ customerId: null }, { customerId: { $exists: false } }],
            customerName: { $nin: [null, '', 'Walk-in customer'] },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $and: [{ $ne: ['$customerPhone', null] }, { $ne: ['$customerPhone', ''] }] },
                { $toLower: { $trim: { input: '$customerPhone' } } },
                { $toLower: { $trim: { input: '$customerName' } } },
              ],
            },
            name: { $last: '$customerName' },
            phone: { $last: { $ifNull: ['$customerPhone', ''] } },
            billCount: { $sum: 1 },
            totalBilled: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            totalDue: { $sum: '$balanceAmount' },
            latestInvoice: { $first: { $ifNull: ['$invoiceNumber', '$orderNumber'] } },
            latestBillDate: { $first: '$createdAt' },
          },
        },
        { $sort: { name: 1 } },
      ]).toArray();

      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const generatedCustomers: Array<Record<string, unknown>> = [];
      for (const saleCustomer of salesCustomers) {
        const phone = normalizePhone(saleCustomer.phone);
        const savedCustomer = customerRecords.find((record) => {
          const savedPhone = normalizePhone(String(record.phone ?? ''));
          return phone
            ? savedPhone === phone
            : String(record.name ?? '').trim().toLowerCase() === saleCustomer.name.trim().toLowerCase();
        });
        if (savedCustomer) {
          const current = savedCustomer.billing as {
            billCount: number;
            totalBilled: number;
            totalPaid: number;
            totalDue: number;
            latestInvoice: string;
            latestBillDate: Date | string | null;
          };
          const currentDate = current.latestBillDate ? new Date(current.latestBillDate).getTime() : 0;
          const salesDate = saleCustomer.latestBillDate ? new Date(saleCustomer.latestBillDate).getTime() : 0;
          savedCustomer.billing = {
            billCount: current.billCount + saleCustomer.billCount,
            totalBilled: current.totalBilled + saleCustomer.totalBilled,
            totalPaid: current.totalPaid + saleCustomer.totalPaid,
            totalDue: current.totalDue + saleCustomer.totalDue,
            latestInvoice: salesDate > currentDate ? saleCustomer.latestInvoice : current.latestInvoice || saleCustomer.latestInvoice,
            latestBillDate: salesDate > currentDate ? saleCustomer.latestBillDate : current.latestBillDate,
          };
          continue;
        }
        generatedCustomers.push({
          id: `sale-${encodeURIComponent(saleCustomer._id)}`,
          name: saleCustomer.name,
          phone: saleCustomer.phone,
          generatedFromSales: true,
          billing: {
            billCount: saleCustomer.billCount,
            totalBilled: saleCustomer.totalBilled,
            totalPaid: saleCustomer.totalPaid,
            totalDue: saleCustomer.totalDue,
            latestInvoice: saleCustomer.latestInvoice,
            latestBillDate: saleCustomer.latestBillDate,
          },
        });
      }
      customerRecords.push(...generatedCustomers);
    }

    return NextResponse.json(customerRecords);
  } catch (error) {
    console.error('Failed to load shop records:', error);
    return NextResponse.json({ error: 'Unable to load records.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ records: string }> }) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;
    const { records } = await context.params;
    const kind = resolveKind(records);
    if (!kind) return NextResponse.json({ error: 'Unknown records collection.' }, { status: 404 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    const normalized = normalizeShopRecord(kind, body);
    if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const now = new Date();
    const database = await connectDatabase();
    const result = await database.collection<ShopRecordDocument>(kind).insertOne({
      ...normalized.value,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as ShopRecordDocument);
    return NextResponse.json({ id: result.insertedId.toHexString(), ...normalized.value, createdAt: now }, { status: 201 });
  } catch (error) {
    console.error('Failed to create shop record:', error);
    return NextResponse.json({ error: 'Unable to save record.' }, { status: 503 });
  }
}
