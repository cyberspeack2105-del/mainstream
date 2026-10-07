import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { requireProductManager } from '@/lib/auth/authorization';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const database = await connectDatabase();
    const products = database.collection('products');
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => dateParts.find((value) => value.type === type)?.value ?? '';
    const dayStart = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+05:30`);
    const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dashboardSettings = await database.collection<{ _id: string; activityResetAt?: Date }>('shopSettings')
      .findOne({ _id: 'dashboard' });
    const activityResetAt = dashboardSettings?.activityResetAt ?? new Date(0);
    const activityStartToday = activityResetAt > dayStart ? activityResetAt : dayStart;
    const [totalProducts, lowStock, outOfStock, lowStockProducts, salesToday, purchaseToday, dueSummary, inventoryValue, recentBills] = await Promise.all([
      products.countDocuments({ isActive: true }),
      products.countDocuments({
        isActive: true,
        $expr: { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
      }),
      products.countDocuments({ isActive: true, currentStock: 0 }),
      products
        .find(
          {
            isActive: true,
            $expr: { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
          },
          { projection: { productName: 1, productCode: 1, currentStock: 1, minimumStock: 1 } }
        )
        .sort({ currentStock: 1, productName: 1 })
        .limit(5)
        .toArray(),
      database.collection('sales').aggregate([
        { $match: { createdAt: { $gte: activityStartToday, $lt: nextDayStart } } },
        { $group: { _id: null, bills: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      ]).toArray(),
      database.collection('purchases').aggregate([
        { $match: { createdAt: { $gte: activityStartToday, $lt: nextDayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      ]).toArray(),
      database.collection('sales').aggregate([
        { $match: { balanceAmount: { $gt: 0 } } },
        { $group: { _id: null, amount: { $sum: '$balanceAmount' }, bills: { $sum: 1 } } },
      ]).toArray(),
      products.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, amount: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } } } },
      ]).toArray(),
      database.collection('sales').find(
        { createdAt: { $gte: activityResetAt } },
        { projection: { invoiceNumber: 1, orderNumber: 1, customerName: 1, grandTotal: 1, paidAmount: 1, balanceAmount: 1, paymentStatus: 1, createdAt: 1 } }
      ).sort({ createdAt: -1 }).limit(6).toArray(),
    ]);

    return NextResponse.json({
      totalProducts,
      lowStock,
      outOfStock,
      todaySales: salesToday[0]?.amount ?? 0,
      todayBills: salesToday[0]?.bills ?? 0,
      todayPurchase: purchaseToday[0]?.amount ?? 0,
      todayPurchaseCount: purchaseToday[0]?.count ?? 0,
      customerDue: dueSummary[0]?.amount ?? 0,
      dueBills: dueSummary[0]?.bills ?? 0,
      inventoryValue: inventoryValue[0]?.amount ?? 0,
      activityResetAt: dashboardSettings?.activityResetAt ?? null,
      recentBills: recentBills.map((bill) => ({
        id: String(bill._id),
        invoiceNumber: bill.invoiceNumber ?? bill.orderNumber ?? 'Invoice',
        customerName: bill.customerName ?? 'Walk-in customer',
        grandTotal: bill.grandTotal ?? 0,
        paidAmount: bill.paidAmount ?? 0,
        balanceAmount: bill.balanceAmount ?? 0,
        paymentStatus: bill.paymentStatus ?? 'Unknown',
        createdAt: bill.createdAt,
      })),
      lowStockProducts: lowStockProducts.map((product) => ({
        id: String(product._id),
        productName: product.productName,
        productCode: product.productCode,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
      })),
    });
  } catch (error) {
    console.error('Failed to load dashboard metrics:', error);
    return NextResponse.json({ error: 'Unable to load shop metrics' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;

    const database = await connectDatabase();
    const resetAt = new Date();
    await database.collection<{ _id: string; activityResetAt: Date; resetBy: string }>('shopSettings').updateOne(
      { _id: 'dashboard' },
      { $set: { activityResetAt: resetAt, resetBy: user.id } },
      { upsert: true }
    );
    return NextResponse.json({ activityResetAt: resetAt });
  } catch (error) {
    console.error('Failed to reset dashboard activity:', error);
    return NextResponse.json({ error: 'Unable to reset Home activity.' }, { status: 503 });
  }
}
