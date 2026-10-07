'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CreditCard, IndianRupee, Search, Wallet } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { formatINR } from '@/lib/utils';

type DueSale = {
  id: string;
  invoiceNumber?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus?: string;
  createdAt: string;
};

export default function DuePage() {
  const [records, setRecords] = useState<DueSale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [payingId, setPayingId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'GPay / QR'>('Cash');
  const [saving, setSaving] = useState(false);

  const loadDues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/due', { cache: 'no-store' });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result ? String(result.error) : 'Unable to load due records.';
        throw new Error(message);
      }
      if (!Array.isArray(result)) throw new Error('Due records response was invalid.');
      setRecords(result as DueSale[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load due records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadDues(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadDues]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? records.filter((record) =>
      [record.invoiceNumber, record.orderNumber, record.customerName, record.customerPhone]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    ) : records;
  }, [records, search]);
  const totalDue = records.reduce((sum, record) => sum + record.balanceAmount, 0);

  function startPayment(record: DueSale) {
    setPayingId(record.id);
    setAmount(record.balanceAmount.toFixed(2));
    setMethod('Cash');
    setStatus('');
    setError('');
  }

  async function collectPayment(event: FormEvent<HTMLFormElement>, record: DueSale) {
    event.preventDefault();
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > record.balanceAmount) {
      setError('Enter a positive payment amount no greater than the outstanding balance.');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const response = await fetch('/api/due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: record.id, amount: paymentAmount, method }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record payment.');
      setStatus(`Payment of ${formatINR(paymentAmount)} recorded for ${record.invoiceNumber ?? record.orderNumber ?? 'this bill'}.`);
      setPayingId('');
      await loadDues();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ShopShell title="Due">
      <div className="mx-auto max-w-7xl space-y-5 pb-24 lg:pb-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Live payment tracking</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Customer Dues</h2>
            <p className="mt-1 text-sm text-slate-500">Outstanding balances from saved sales invoices.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-700"><Wallet className="h-4 w-4" /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Total outstanding</p><p className="text-lg font-black text-amber-900">{formatINR(totalDue)}</p></div>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {status && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p>}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Unpaid and partially paid bills</h3>
              <p className="mt-1 text-xs text-slate-500">{records.length} invoices with a remaining balance</p>
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, mobile or invoice" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400" />
            </label>
          </div>
          <div className="divide-y divide-slate-100">
            {!loading && filtered.map((record) => (
              <article key={record.id} className="p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{record.customerName || 'Walk-in customer'}</h4>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{record.paymentStatus || 'Due'}</span>
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-500">{record.customerPhone || 'No mobile number'} · {record.invoiceNumber || record.orderNumber || 'Invoice'}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(record.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-3 gap-2 text-left sm:min-w-0 sm:gap-3 sm:text-right">
                    <div><p className="text-[10px] text-slate-500">Bill total</p><p className="mt-1 text-xs font-bold text-slate-800">{formatINR(record.grandTotal)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Paid</p><p className="mt-1 text-xs font-semibold text-emerald-700">{formatINR(record.paidAmount)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Balance</p><p className="mt-1 text-sm font-black text-amber-800">{formatINR(record.balanceAmount)}</p></div>
                  </div>
                </div>
                {payingId === record.id ? (
                  <form onSubmit={(event) => void collectPayment(event, record)} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                    <label className="text-xs font-bold text-slate-600">Amount
                      <input required type="number" min="0.01" max={record.balanceAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">Payment method
                      <select value={method} onChange={(event) => setMethod(event.target.value as 'Cash' | 'GPay / QR')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option>Cash</option><option>GPay / QR</option></select>
                    </label>
                    <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"><IndianRupee className="h-4 w-4" />{saving ? 'Saving…' : 'Record payment'}</button>
                    <button type="button" onClick={() => setPayingId('')} className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button>
                  </form>
                ) : (
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={() => startPayment(record)} className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"><CreditCard className="h-3.5 w-3.5" /> Record payment</button>
                  </div>
                )}
              </article>
            ))}
            {loading && <p className="p-10 text-center text-sm text-slate-500">Loading live due records…</p>}
            {!loading && !filtered.length && <p className="p-10 text-center text-sm text-slate-500">{records.length ? 'No dues match your search.' : 'No outstanding customer balances.'}</p>}
          </div>
        </section>
      </div>
    </ShopShell>
  );
}
