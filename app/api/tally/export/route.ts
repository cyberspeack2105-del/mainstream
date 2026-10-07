import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function indiaDateStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return new Date(date.getTime() - IST_OFFSET_MS);
}

function dateInIndia(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}`;
}

function xml(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function amount(value: unknown) {
  const number = Number(value);
  return (Number.isFinite(number) ? Math.round(number * 100) / 100 : 0).toFixed(2);
}

function stableGuid(type: string, id: unknown) {
  return createHash('sha1').update(`${type}:${String(id)}`).digest('hex').toUpperCase();
}

function ledgerEntry(name: string, value: number, isDebit: boolean) {
  const signedAmount = amount(isDebit ? -value : value);
  return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${signedAmount}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
}

function voucher({
  id,
  date,
  type,
  number,
  narration,
  entries,
}: {
  id: string;
  date: Date;
  type: 'Sales' | 'Purchase' | 'Receipt' | 'Payment';
  number: string;
  narration: string;
  entries: string[];
}) {
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${type}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${dateInIndia(date)}</DATE><GUID>${stableGuid(type, id)}</GUID><VOUCHERTYPENAME>${type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(number)}</VOUCHERNUMBER><REFERENCE>${xml(number)}</REFERENCE><NARRATION>${xml(narration)}</NARRATION><PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>${entries.join('')}</VOUCHER></TALLYMESSAGE>`;
}

function envelope(company: string, reportName: 'All Masters' | 'Vouchers', messages: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>${reportName}</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${messages.join('\n')}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

function ledger(name: string, parent: string) {
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xml(name)}" ACTION="Create"><NAME>${xml(name)}</NAME><PARENT>${xml(parent)}</PARENT><ISBILLWISEON>${parent === 'Sundry Debtors' || parent === 'Sundry Creditors' ? 'Yes' : 'No'}</ISBILLWISEON></LEDGER></TALLYMESSAGE>`;
}

function currentDateIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const from = params.get('from') ?? currentDateIndia();
    const to = params.get('to') ?? currentDateIndia();
    const company = params.get('company')?.trim() ?? '';
    const format = params.get('format');
    const start = indiaDateStart(from);
    const toStart = indiaDateStart(to);
    if (!start || !toStart || from > to || Math.floor((toStart.getTime() - start.getTime()) / DAY_MS) >= 366) {
      return NextResponse.json({ error: 'Choose a valid date range of no more than 366 days.' }, { status: 400 });
    }
    if (!company || company.length > 120) {
      return NextResponse.json({ error: 'Enter the exact company name shown in TallyPrime.' }, { status: 400 });
    }
    if (format !== 'masters' && format !== 'vouchers') {
      return NextResponse.json({ error: 'Choose a ledger masters or vouchers export.' }, { status: 400 });
    }

    const end = new Date(toStart.getTime() + DAY_MS);
    const dateFilter = { createdAt: { $gte: start, $lt: end } };
    const database = await connectDatabase();
    const [sales, purchases, payments] = await Promise.all([
      database.collection('sales').find(dateFilter).sort({ createdAt: 1 }).limit(5000).toArray(),
      database.collection('purchases').find(dateFilter).sort({ createdAt: 1 }).limit(5000).toArray(),
      database.collection('payments').find(dateFilter).sort({ createdAt: 1 }).limit(5000).toArray(),
    ]);
    if (sales.length >= 5000 || purchases.length >= 5000 || payments.length >= 5000) {
      return NextResponse.json({ error: 'This date range contains too many records for one export. Choose a shorter range.' }, { status: 413 });
    }
    if (format === 'vouchers' && !sales.length && !purchases.length && !payments.length) {
      return NextResponse.json({ error: 'No sales, purchases, or payments were found for this period.' }, { status: 404 });
    }

    const paymentSaleIds = payments
      .map((payment) => payment.saleId)
      .filter((id): id is ObjectId => id instanceof ObjectId);
    const linkedSales = paymentSaleIds.length
      ? await database.collection('sales').find({ _id: { $in: paymentSaleIds } }, { projection: { customerName: 1, orderNumber: 1 } }).toArray()
      : [];
    const saleById = new Map(linkedSales.map((sale) => [String(sale._id), sale]));
    const masterNames = new Map<string, string>();
    const addParty = (name: unknown, isCustomer: boolean) => {
      const party = typeof name === 'string' && name.trim() ? name.trim() : (isCustomer ? 'Walk-in customer' : 'Supplier');
      const ledgerName = `${isCustomer ? 'Customer' : 'Supplier'} - ${party}`;
      masterNames.set(ledgerName.toLowerCase(), ledgerName);
      return ledgerName;
    };
    sales.forEach((sale) => addParty(sale.customerName, true));
    purchases.forEach((purchase) => addParty(purchase.supplierName, false));
    payments.forEach((payment) => {
      const linkedSale = saleById.get(String(payment.saleId));
      if (linkedSale) addParty(linkedSale.customerName, true);
    });

    const masters = [
      ledger('MSE Sales', 'Sales Accounts'),
      ledger('MSE Purchases', 'Purchase Accounts'),
      ledger('MSE Sales Discount', 'Indirect Expenses'),
      ledger('MSE GST Output', 'Duties & Taxes'),
      ledger('MSE GST Input', 'Duties & Taxes'),
      ledger('MSE GPay QR', 'Bank Accounts'),
      ...[...masterNames.values()].map((name) => ledger(name, name.startsWith('Customer - ') ? 'Sundry Debtors' : 'Sundry Creditors')),
    ];

    const messages: string[] = [];
    for (const sale of sales) {
      const customerLedger = addParty(sale.customerName, true);
      const taxable = Math.max(0, Number(sale.subtotal ?? 0) - Number(sale.discount ?? 0));
      const discount = Math.max(0, Number(sale.discount ?? 0));
      const gst = Math.max(0, Number(sale.gstAmount ?? 0));
      const entries = [
        ledgerEntry(customerLedger, Number(sale.grandTotal ?? 0), true),
        ledgerEntry('MSE Sales', taxable, false),
        ...(discount > 0 ? [ledgerEntry('MSE Sales Discount', discount, true)] : []),
        ...(gst > 0 ? [ledgerEntry('MSE GST Output', gst, false)] : []),
      ];
      messages.push(voucher({
        id: String(sale._id),
        date: sale.createdAt instanceof Date ? sale.createdAt : new Date(sale.createdAt ?? sale.date),
        type: 'Sales',
        number: String(sale.invoiceNumber ?? sale.orderNumber ?? sale._id),
        narration: `Shop invoice ${sale.invoiceNumber ?? sale.orderNumber ?? ''}`,
        entries,
      }));
    }

    for (const purchase of purchases) {
      const supplierLedger = addParty(purchase.supplierName, false);
      const entries = [
        ledgerEntry('MSE Purchases', Number(purchase.subtotal ?? 0), true),
        ...(Number(purchase.gstAmount ?? 0) > 0 ? [ledgerEntry('MSE GST Input', Number(purchase.gstAmount), true)] : []),
        ledgerEntry(supplierLedger, Number(purchase.grandTotal ?? 0), false),
      ];
      messages.push(voucher({
        id: String(purchase._id),
        date: purchase.createdAt instanceof Date ? purchase.createdAt : new Date(purchase.createdAt ?? purchase.date),
        type: 'Purchase',
        number: String(purchase.invoiceNumber ?? purchase._id),
        narration: `Supplier invoice ${purchase.invoiceNumber ?? ''}`,
        entries,
      }));
      if (Number(purchase.paidAmount ?? 0) > 0) {
        messages.push(voucher({
          id: `purchase-payment-${purchase._id}`,
          date: purchase.createdAt instanceof Date ? purchase.createdAt : new Date(purchase.createdAt ?? purchase.date),
          type: 'Payment',
          number: `PAY-${purchase.invoiceNumber ?? purchase._id}`,
          narration: `Payment for supplier invoice ${purchase.invoiceNumber ?? ''}`,
          entries: [
            ledgerEntry(supplierLedger, Number(purchase.paidAmount), true),
            ledgerEntry('Cash', Number(purchase.paidAmount), false),
          ],
        }));
      }
    }

    for (const payment of payments) {
      const linkedSale = saleById.get(String(payment.saleId));
      const customerLedger = addParty(linkedSale?.customerName, true);
      const paidByUpi = String(payment.method ?? '').toLowerCase().includes('qr') || String(payment.method ?? '').toLowerCase().includes('upi');
      const amountPaid = Number(payment.amount ?? 0);
      if (amountPaid <= 0) continue;
      messages.push(voucher({
        id: `receipt-${payment._id}`,
        date: payment.createdAt instanceof Date ? payment.createdAt : new Date(payment.createdAt),
        type: 'Receipt',
        number: `REC-${payment.orderNumber ?? ''}-${payment._id}`,
        narration: `Customer payment received ${payment.orderNumber ?? ''}`,
        entries: [
          ledgerEntry(paidByUpi ? 'MSE GPay QR' : 'Cash', amountPaid, true),
          ledgerEntry(customerLedger, amountPaid, false),
        ],
      }));
    }

    const content = format === 'masters'
      ? envelope(company, 'All Masters', masters)
      : envelope(company, 'Vouchers', messages);
    const fileName = `main-stream-tally-${format}-${from}-to-${to}.xml`;
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to export TallyPrime XML:', error);
    return NextResponse.json({ error: 'Unable to build the TallyPrime XML export.' }, { status: 503 });
  }
}
