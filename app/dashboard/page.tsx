'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CreditCard,
  FileText,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { formatINR } from '@/lib/utils';

type DashboardData = {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  todaySales: number;
  todayBills: number;
  todayPurchase: number;
  todayPurchaseCount: number;
  customerDue: number;
  dueBills: number;
  inventoryValue: number;
  activityResetAt: string | null;
  recentBills: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: string;
    createdAt: string;
  }>;
  lowStockProducts: Array<{
    id: string;
    productName: string;
    productCode: string;
    currentStock: number;
    minimumStock: number;
  }>;
};

const metrics: Array<{
  label: string;
  icon: LucideIcon;
  key: 'todaySales' | 'todayBills' | 'todayPurchase' | 'totalProducts' | 'lowStock' | 'outOfStock' | 'customerDue';
  tone: string;
}> = [
  { label: "Today's Sales", icon: TrendingUp, key: 'todaySales', tone: 'sky' },
  { label: "Today's Bills", icon: FileText, key: 'todayBills', tone: 'blue' },
  { label: "Today's Purchase", icon: ShoppingBag, key: 'todayPurchase', tone: 'violet' },
  { label: 'Total Products', icon: Package, key: 'totalProducts', tone: 'slate' },
  { label: 'Low Stock', icon: AlertTriangle, key: 'lowStock', tone: 'amber' },
  { label: 'Out of Stock', icon: Boxes, key: 'outOfStock', tone: 'rose' },
  { label: 'Customer Due', icon: CreditCard, key: 'customerDue', tone: 'emerald' },
];

const tones: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load dashboard');
        if (active) {
          setData(result as DashboardData);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (active) setCanReset(result.user?.role === 'OWNER' || result.user?.role === 'MANAGER');
      })
      .catch((loadError: unknown) => console.error('Unable to verify dashboard permissions:', loadError));
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function resetHomeActivity() {
    if (!window.confirm('Start fresh on Home? Previous sales, purchases, payments, and stock history will remain saved, but Home activity totals and recent bills will start from now.')) return;
    setResetting(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start fresh on Home.');
      const refreshed = await fetch('/api/dashboard', { cache: 'no-store' });
      const dashboard = await refreshed.json();
      if (!refreshed.ok) throw new Error(dashboard.error || 'Home was reset, but the dashboard could not refresh.');
      setData(dashboard as DashboardData);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset Home activity.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <ShopShell title="Home">
      <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-0">
        <section className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-600">MAIN STREAM ELECTRONICS</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Shop overview</h2>
            <p className="mt-2 text-sm text-slate-500">Live sales, billing, purchases, customer dues, and inventory overview.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canReset && <button type="button" onClick={() => void resetHomeActivity()} disabled={resetting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} /> {resetting ? 'Starting fresh…' : 'Start fresh on Home'}
            </button>}
            <Link href="/billing" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-sky-600">
              <Plus className="h-4 w-4" /> QUICK BILL
            </Link>
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <section aria-label="Shop metrics" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
          {metrics.map(({ label, icon: Icon, tone, key }) => {
            const value = data?.[key];
            const metricValue = data ? (['todaySales', 'todayPurchase', 'customerDue'].includes(key) ? formatINR(Number(value)) : String(value)) : '…';
            const note = !data
              ? 'Loading live records'
              : key === 'todayBills'
                ? `${value} bills today`
                : key === 'todayPurchase'
                  ? `${data.todayPurchaseCount} purchases today`
                  : key === 'customerDue'
                    ? `${data.dueBills} unpaid bills`
                    : ['totalProducts', 'lowStock', 'outOfStock'].includes(key)
                      ? 'From active product records'
                      : data.activityResetAt && ['todaySales', 'todayBills', 'todayPurchase'].includes(key)
                        ? 'Since Home activity reset'
                        : 'Today’s recorded transactions';
            return (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-4 break-words text-lg font-black tracking-tight text-slate-900 sm:text-2xl">{metricValue}</p>
                <p className="mt-1 break-words text-[10px] text-slate-400">{note}</p>
              </div>
            );
          })}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Recent Bills</h3>
                <p className="mt-1 text-xs text-slate-500">{data ? `${data.recentBills.length} latest sales` : 'Loading sales records…'}</p>
              </div>
              <Link href="/billing" className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800">New bill <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {data?.recentBills.length ? (
              <div className="divide-y divide-slate-100">
                {data.recentBills.map((bill) => (
                  <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{bill.customerName}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{bill.invoiceNumber} · {new Date(bill.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">{formatINR(bill.grandTotal)}</p>
                      <p className={`mt-1 text-[10px] font-semibold ${bill.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{bill.balanceAmount > 0 ? `${formatINR(bill.balanceAmount)} due` : bill.paymentStatus}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="p-8 text-center text-sm text-slate-500">{data ? 'No bills recorded yet.' : 'Loading recent bills…'}</p>}
          </section>

          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Low Stock Alerts</h3>
                  <p className="mt-1 text-xs text-slate-500">Based on saved product levels</p>
                </div>
              </div>
              {data?.lowStockProducts.length ? (
                <div className="divide-y divide-slate-100">
                  {data.lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{product.productName}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{product.productCode}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{product.currentStock} / {product.minimumStock}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="p-7 text-center text-xs text-slate-500">{data ? 'No low-stock products.' : 'Loading product levels…'}</p>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Shop Pulse</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{data ? `${data.todayBills} bills and ${data.todayPurchaseCount} purchases recorded today.` : 'Loading live business activity…'}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2.5">
                <span className="text-xs font-semibold text-sky-800">Inventory value</span>
                <span className="text-xs font-bold text-sky-700">{data ? formatINR(data.inventoryValue) : '…'}</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Estimated from current stock × product purchase price.</p>
            </section>
          </div>
        </div>
      </div>
    </ShopShell>
  );
}
