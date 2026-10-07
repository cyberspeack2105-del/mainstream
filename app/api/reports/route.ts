import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dateStringInIndia(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function indiaDateStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const utcDate = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcDate);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return new Date(utcDate - IST_OFFSET_MS);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const today = dateStringInIndia(new Date());
    const defaultFrom = new Date(`${today}T00:00:00+05:30`);
    defaultFrom.setTime(defaultFrom.getTime() - 29 * DAY_MS);
    const defaultFromText = dateStringInIndia(defaultFrom);
    const from = request.nextUrl.searchParams.get('from') ?? defaultFromText;
    const to = request.nextUrl.searchParams.get('to') ?? today;
    const start = indiaDateStart(from);
    const endDate = indiaDateStart(to);
    if (!start || !endDate || from > to) {
      return NextResponse.json({ error: 'Choose a valid date range.' }, { status: 400 });
    }
    if (Math.floor((endDate.getTime() - start.getTime()) / DAY_MS) >= 366) {
      return NextResponse.json({ error: 'Report range cannot exceed 366 days.' }, { status: 400 });
    }
    const end = new Date(endDate.getTime() + DAY_MS);
    const createdInRange = { createdAt: { $gte: start, $lt: end } };
    const database = await connectDatabase();
    const products = database.collection('products');
    const [sales, purchases, payments, inventory, topProducts, salesByDay, purchasesByDay, duePurchases, dueSales, customerCount, supplierCount] = await Promise.all([
      database.collection('sales').aggregate([
        { $match: createdInRange },
        { $group: {
          _id: null,
          billCount: { $sum: 1 },
          grossSales: { $sum: '$grandTotal' },
          discounts: { $sum: '$discount' },
          gstAmount: { $sum: '$gstAmount' },
          collectedAtBilling: { $sum: '$paidAmount' },
          currentDue: { $sum: '$balanceAmount' },
        } },
      ]).toArray(),
      database.collection('purchases').aggregate([
        { $match: createdInRange },
        { $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$grandTotal' },
          paid: { $sum: '$paidAmount' },
          due: { $sum: '$balanceAmount' },
        } },
      ]).toArray(),
      database.collection('payments').aggregate([
        { $match: createdInRange },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]).toArray(),
      products.aggregate([
        { $match: { isActive: true } },
        { $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          stockUnits: { $sum: '$currentStock' },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] } },
          costValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
          retailValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
        } },
      ]).toArray(),
      database.collection('sales').aggregate([
        { $match: createdInRange },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.productName',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        } },
        { $sort: { quantity: -1, revenue: -1 } },
        { $limit: 8 },
      ]).toArray(),
      database.collection('sales').aggregate([
        { $match: createdInRange },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          sales: { $sum: '$grandTotal' },
          bills: { $sum: 1 },
        } },
      ]).toArray(),
      database.collection('purchases').aggregate([
        { $match: createdInRange },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          purchases: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        } },
      ]).toArray(),
      database.collection('purchases').aggregate([
        { $match: { balanceAmount: { $gt: 0 } } },
        { $group: { _id: null, amount: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
      ]).toArray(),
      database.collection('sales').aggregate([
        { $match: { balanceAmount: { $gt: 0 } } },
        { $group: { _id: null, amount: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
      ]).toArray(),
      database.collection('customers').countDocuments({ isActive: true }),
      database.collection('suppliers').countDocuments({ isActive: true }),
    ]);

    const daily = new Map<string, { date: string; sales: number; bills: number; purchases: number; purchaseCount: number }>();
    for (const record of salesByDay) {
      daily.set(String(record._id), {
        date: String(record._id),
        sales: Number(record.sales ?? 0),
        bills: Number(record.bills ?? 0),
        purchases: 0,
        purchaseCount: 0,
      });
    }
    for (const record of purchasesByDay) {
      const date = String(record._id);
      const value = daily.get(date) ?? { date, sales: 0, bills: 0, purchases: 0, purchaseCount: 0 };
      value.purchases = Number(record.purchases ?? 0);
      value.purchaseCount = Number(record.count ?? 0);
      daily.set(date, value);
    }

    return NextResponse.json({
      range: { from, to },
      sales: sales[0] ?? { billCount: 0, grossSales: 0, discounts: 0, gstAmount: 0, collectedAtBilling: 0, currentDue: 0 },
      purchases: purchases[0] ?? { count: 0, total: 0, paid: 0, due: 0 },
      payments: payments[0] ?? { count: 0, amount: 0 },
      inventory: inventory[0] ?? { totalProducts: 0, stockUnits: 0, lowStock: 0, outOfStock: 0, costValue: 0, retailValue: 0 },
      currentBalances: {
        customerDue: dueSales[0]?.amount ?? 0,
        supplierDue: duePurchases[0]?.amount ?? 0,
        dueBills: dueSales[0]?.count ?? 0,
        duePurchaseInvoices: duePurchases[0]?.count ?? 0,
      },
      customerCount,
      supplierCount,
      topProducts: topProducts.map((product) => ({
        name: String(product._id ?? 'Unknown product'),
        quantity: Number(product.quantity ?? 0),
        revenue: Number(product.revenue ?? 0),
      })),
      trend: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)),
    });
  } catch (error) {
    console.error('Failed to build live reports:', error);
    return NextResponse.json({ error: 'Unable to load reports from shop records.' }, { status: 503 });
  }
}
