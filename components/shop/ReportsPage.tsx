'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart3, Boxes, Download, FileText, IndianRupee, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { formatINR } from '@/lib/utils';

type DailyActivity = { date: string; sales: number; bills: number; purchases: number; purchaseCount: number };
type ReportData = {
  range: { from: string; to: string };
  sales: { billCount: number; grossSales: number; discounts: number; gstAmount: number; collectedAtBilling: number; currentDue: number };
  purchases: { count: number; total: number; paid: number; due: number };
  payments: { count: number; amount: number };
  inventory: { totalProducts: number; stockUnits: number; lowStock: number; outOfStock: number; costValue: number; retailValue: number };
  currentBalances: { customerDue: number; supplierDue: number; dueBills: number; duePurchaseInvoices: number };
  customerCount: number;
  supplierCount: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  trend: DailyActivity[];
};

function indiaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function last30Days() {
  const [year, month, day] = indiaToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 29 * 86_400_000).toISOString().slice(0, 10);
}

const zeroData: ReportData = {
  range: { from: '', to: '' },
  sales: { billCount: 0, grossSales: 0, discounts: 0, gstAmount: 0, collectedAtBilling: 0, currentDue: 0 },
  purchases: { count: 0, total: 0, paid: 0, due: 0 },
  payments: { count: 0, amount: 0 },
  inventory: { totalProducts: 0, stockUnits: 0, lowStock: 0, outOfStock: 0, costValue: 0, retailValue: 0 },
  currentBalances: { customerDue: 0, supplierDue: 0, dueBills: 0, duePurchaseInvoices: 0 },
  customerCount: 0,
  supplierCount: 0,
  topProducts: [],
  trend: [],
};

export default function ReportsPage() {
  const [from, setFrom] = useState(last30Days);
  const [to, setTo] = useState(indiaToday);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(`/api/reports?${query.toString()}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load reports.');
      setData(result as ReportData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadReports]);

  const totals = data ?? zeroData;
  const maxActivity = useMemo(() => Math.max(1, ...totals.trend.flatMap((day) => [day.sales, day.purchases])), [totals.trend]);
  const metrics = [
    { title: 'Sales', value: formatINR(totals.sales.grossSales), note: `${totals.sales.billCount} bills`, icon: IndianRupee, tone: 'bg-sky-50 text-sky-700' },
    { title: 'Purchases', value: formatINR(totals.purchases.total), note: `${totals.purchases.count} invoices`, icon: ShoppingBag, tone: 'bg-violet-50 text-violet-700' },
    { title: 'Payments received', value: formatINR(totals.payments.amount), note: `${totals.payments.count} payment entries`, icon: FileText, tone: 'bg-emerald-50 text-emerald-700' },
    { title: 'GST billed', value: formatINR(totals.sales.gstAmount), note: 'From recorded sales invoices', icon: BarChart3, tone: 'bg-blue-50 text-blue-700' },
  ];

  function exportCsv() {
    const rows = [
      ['Report', `From ${from} to ${to}`],
      ['Sales bills', totals.sales.billCount],
      ['Sales total (INR)', totals.sales.grossSales],
      ['Discounts (INR)', totals.sales.discounts],
      ['GST billed (INR)', totals.sales.gstAmount],
      ['Payments received (INR)', totals.payments.amount],
      ['Purchases (INR)', totals.purchases.total],
      ['Customer dues (current INR)', totals.currentBalances.customerDue],
      ['Supplier dues (current INR)', totals.currentBalances.supplierDue],
      ['Inventory cost value (INR)', totals.inventory.costValue],
      [],
      ['Date', 'Sales (INR)', 'Bills', 'Purchases (INR)', 'Purchase invoices'],
      ...totals.trend.map((day) => [day.date, day.sales, day.bills, day.purchases, day.purchaseCount]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `main-stream-report-${from}-to-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!data) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const money = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(15, 23, 42);
    pdf.text('MAIN STREAM ELECTRONICS', margin, 18);
    pdf.setFontSize(12);
    pdf.setTextColor(2, 132, 199);
    pdf.text('Business Report', margin, 26);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Period: ${from} to ${to} (India time)`, margin, 33);
    pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 33, { align: 'right' });

    autoTable(pdf, {
      startY: 40,
      margin: { left: margin, right: margin },
      head: [['Summary', 'Value', 'Summary', 'Value']],
      body: [
        ['Sales', money(totals.sales.grossSales), 'Sales bills', String(totals.sales.billCount)],
        ['Purchases', money(totals.purchases.total), 'Purchase invoices', String(totals.purchases.count)],
        ['Payments received', money(totals.payments.amount), 'Payment entries', String(totals.payments.count)],
        ['GST billed', money(totals.sales.gstAmount), 'Discounts', money(totals.sales.discounts)],
        ['Customer dues (current)', money(totals.currentBalances.customerDue), 'Supplier dues (current)', money(totals.currentBalances.supplierDue)],
        ['Inventory cost value', money(totals.inventory.costValue), 'Inventory retail value', money(totals.inventory.retailValue)],
        ['Active products', String(totals.inventory.totalProducts), `Low stock / out of stock`, `${totals.inventory.lowStock} / ${totals.inventory.outOfStock}`],
        ['Customers', String(totals.customerCount), 'Suppliers', String(totals.supplierCount)],
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: [51, 65, 85], lineColor: [226, 232, 240] },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 43 }, 2: { cellWidth: 48 }, 3: { cellWidth: 'auto' } },
    });

    const summaryEnd = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
    autoTable(pdf, {
      startY: summaryEnd + 8,
      margin: { left: margin, right: margin },
      head: [['Date', 'Sales (INR)', 'Bills', 'Purchases (INR)', 'Purchase invoices']],
      body: totals.trend.map((day) => [day.date, money(day.sales), String(day.bills), money(day.purchases), String(day.purchaseCount)]),
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 31 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });

    let nextY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    if (totals.topProducts.length && nextY > 235) {
      pdf.addPage();
      nextY = 18;
    } else {
      nextY += 8;
    }
    autoTable(pdf, {
      startY: nextY,
      margin: { left: margin, right: margin },
      head: [['Top selling product', 'Units sold', 'Revenue (INR)']],
      body: totals.topProducts.length
        ? totals.topProducts.map((product) => [product.name, String(product.quantity), money(product.revenue)])
        : [['No product sales in this period', '—', '—']],
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Generated from live shop records. INR amounts; current balances are as of export time.', margin, 288);
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 288, { align: 'right' });
    }
    pdf.save(`main-stream-report-${from}-to-${to}.pdf`);
  }

  return (
    <ShopShell title="Reports">
      <div className="mx-auto max-w-7xl space-y-5 pb-24 lg:pb-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Live business intelligence</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Reports</h2>
            <p className="mt-1 text-sm text-slate-500">Sales, GST, purchases, payments and inventory from saved shop records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportPdf} disabled={!data || loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"><FileText className="h-4 w-4" /> Download PDF</button>
            <button type="button" onClick={exportCsv} disabled={!data || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-bold text-slate-600">From
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="flex-1 text-xs font-bold text-slate-600">To
            <input type="date" value={to} min={from} max={indiaToday()} onChange={(event) => setTo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => void loadReports()} disabled={loading || !from || !to} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Updating…' : 'Refresh report'}</button>
        </section>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {data && <p className="text-xs text-slate-500">Showing transactions from <span className="font-semibold text-slate-700">{from}</span> through <span className="font-semibold text-slate-700">{to}</span> (India time).</p>}

        <section aria-label="Report metrics" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ title, value, note, icon: Icon, tone }) => (
            <article key={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-500">{title}</p><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span></div>
              <p className="mt-4 break-words text-lg font-black tracking-tight text-slate-900 sm:text-2xl">{loading && !data ? '…' : value}</p>
              <p className="mt-1 text-[10px] text-slate-400">{note}</p>
            </article>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <h3 className="text-sm font-extrabold text-slate-900">Daily sales and purchases</h3>
              <p className="mt-1 text-xs text-slate-500">Daily totals for the selected period</p>
            </div>
            <div className="max-h-[390px] space-y-3 overflow-y-auto p-4 sm:p-5">
              {totals.trend.map((day) => (
                <div key={day.date} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[100px_minmax(0,1fr)_auto]">
                  <time className="text-[10px] font-semibold text-slate-500 sm:text-xs">{new Date(`${day.date}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</time>
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(day.sales ? 2 : 0, day.sales / maxActivity * 100)}%` }} /></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(day.purchases ? 2 : 0, day.purchases / maxActivity * 100)}%` }} /></div>
                  </div>
                  <div className="hidden min-w-[145px] text-right sm:block"><p className="text-[10px] font-bold text-sky-700">{formatINR(day.sales)} <span className="font-normal text-slate-400">· {day.bills} bills</span></p><p className="mt-1 text-[10px] font-semibold text-violet-700">{formatINR(day.purchases)} <span className="font-normal text-slate-400">· {day.purchaseCount} purchases</span></p></div>
                  <div className="col-start-2 flex justify-between text-[10px] sm:hidden"><span className="font-semibold text-sky-700">{formatINR(day.sales)}</span><span className="font-semibold text-violet-700">{formatINR(day.purchases)}</span></div>
                </div>
              ))}
              {!loading && !totals.trend.length && <p className="py-12 text-center text-sm text-slate-500">No sales or purchase activity in this period.</p>}
              {loading && !data && <p className="py-12 text-center text-sm text-slate-500">Loading report data…</p>}
            </div>
            <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-3 text-[10px] font-semibold text-slate-500 sm:px-5"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Sales</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" />Purchases</span></div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="text-sm font-extrabold text-slate-900">Top selling products</h3><p className="mt-1 text-xs text-slate-500">By units sold in the selected period</p></div>
            <div className="divide-y divide-slate-100">
              {totals.topProducts.map((product, index) => (
                <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[10px] font-black text-sky-700">{index + 1}</span><p className="truncate text-xs font-bold text-slate-800">{product.name}</p></div>
                  <div className="shrink-0 text-right"><p className="text-xs font-extrabold text-slate-900">{product.quantity} units</p><p className="mt-1 text-[10px] text-slate-500">{formatINR(product.revenue)}</p></div>
                </div>
              ))}
              {!loading && !totals.topProducts.length && <p className="p-10 text-center text-sm text-slate-500">No product sales in this period.</p>}
              {loading && !data && <p className="p-10 text-center text-sm text-slate-500">Loading products…</p>}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4"><h3 className="text-sm font-extrabold text-slate-900">Current shop position</h3><p className="mt-1 text-xs text-slate-500">Live balances and stock valuation, regardless of selected date range.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <PositionCard icon={IndianRupee} label="Customer dues" value={formatINR(totals.currentBalances.customerDue)} note={`${totals.currentBalances.dueBills} bills`} />
            <PositionCard icon={ShoppingBag} label="Supplier dues" value={formatINR(totals.currentBalances.supplierDue)} note={`${totals.currentBalances.duePurchaseInvoices} invoices`} />
            <PositionCard icon={Boxes} label="Inventory cost value" value={formatINR(totals.inventory.costValue)} note={`${totals.inventory.stockUnits} units`} />
            <PositionCard icon={BarChart3} label="Inventory retail value" value={formatINR(totals.inventory.retailValue)} note="At current selling prices" />
            <PositionCard icon={Boxes} label="Active products" value={String(totals.inventory.totalProducts)} note={`${totals.inventory.lowStock} low stock · ${totals.inventory.outOfStock} out`} />
            <PositionCard icon={Users} label="Customers" value={String(totals.customerCount)} note={`${totals.supplierCount} suppliers`} />
            <PositionCard icon={FileText} label="Discounts" value={formatINR(totals.sales.discounts)} note="For selected sales" />
            <PositionCard icon={IndianRupee} label="Supplier purchase due" value={formatINR(totals.purchases.due)} note="From invoices in selected period" />
          </div>
        </section>
      </div>
    </ShopShell>
  );
}

function PositionCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return <article className="min-w-0 rounded-lg bg-slate-50 p-3 sm:p-4"><div className="flex items-center gap-2 text-sky-700"><Icon className="h-4 w-4 shrink-0" /><p className="truncate text-[10px] font-bold sm:text-xs">{label}</p></div><p className="mt-3 break-words text-sm font-black text-slate-900 sm:text-base">{value}</p><p className="mt-1 text-[10px] text-slate-500">{note}</p></article>;
}
