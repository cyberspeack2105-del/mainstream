'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Edit2, Plus, Search, ToggleLeft, X } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { SHOP_RECORD_FIELDS, type ShopRecordKind } from '@/lib/shop-records';
import { formatINR } from '@/lib/utils';

type ShopRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  contactPerson?: string;
  notes?: string;
  generatedFromSales?: boolean;
  billing?: {
    billCount: number;
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    latestInvoice: string;
    latestBillDate: string | null;
  };
};

const titles: Record<ShopRecordKind, string> = { customers: 'Customers', suppliers: 'Suppliers' };
const emptyRecord = (kind: ShopRecordKind) =>
  Object.fromEntries(SHOP_RECORD_FIELDS[kind].map(({ key }) => [key, ''])) as Record<string, string>;

export default function ShopRecordsPage({ kind }: { kind: ShopRecordKind }) {
  const title = titles[kind];
  const [records, setRecords] = useState<ShopRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/${kind}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to load ${title.toLowerCase()}.`);
      setRecords(result as ShopRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Unable to load ${title.toLowerCase()}.`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [kind, title]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRecords(), 0);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        setCanManage(result.user?.role === 'OWNER' || result.user?.role === 'MANAGER');
      })
      .catch((loadError: unknown) => console.error('Unable to verify record permissions:', loadError));
    return () => window.clearTimeout(timeout);
  }, [kind, loadRecords]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? records.filter((record) => Object.values(record).some((value) => String(value ?? '').toLowerCase().includes(query))) : records;
  }, [records, search]);

  function beginEdit(record?: ShopRecord) {
    setEditingId(record?.id ?? '');
    const values = emptyRecord(kind);
    if (record) for (const key of Object.keys(values)) values[key] = String(record[key as keyof ShopRecord] ?? '');
    setForm(values);
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingId ? `/api/${kind}/${encodeURIComponent(editingId)}` : `/api/${kind}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save record.');
      setForm(null);
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save record.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(record: ShopRecord) {
    if (!window.confirm(`Deactivate ${record.name}?`)) return;
    try {
      const response = await fetch(`/api/${kind}/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to deactivate record.');
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to deactivate record.');
    }
  }

  const secondary = kind === 'customers'
    ? ['billing', 'due']
    : ['contactPerson', 'city', 'gstin', 'email'];

  return (
    <ShopShell title={title}>
      <div className="mx-auto max-w-7xl space-y-5 pb-20 lg:pb-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Live shop records</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{records.length} {kind} with saved records or billing activity</p>
          </div>
          {canManage && <button type="button" onClick={() => beginEdit()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-600"><Plus className="h-4 w-4" /> Add {kind === 'customers' ? 'Customer' : 'Supplier'}</button>}
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <label className="relative block max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full ${kind === 'customers' ? 'min-w-[620px]' : 'min-w-[740px]'} text-left text-xs`}>
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">{kind === 'customers' ? 'Customer / Mobile' : 'Name / Contact'}</th>{secondary.map((key) => <th key={key} className="px-4 py-3">{key === 'gstin' ? 'GSTIN' : key === 'billing' ? 'Bills / Total' : key === 'due' ? 'Paid / Due' : key}</th>)}{canManage && <th className="px-4 py-3 text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-bold text-slate-900">{record.name}</p><p className="mt-1 text-slate-500">{record.phone}</p></td>
                    {secondary.map((key) => (
                      <td key={key} className="px-4 py-3 text-slate-600">
                        {key === 'billing' && kind === 'customers' ? (
                          <><p className="font-semibold text-slate-800">{record.billing?.billCount ?? 0} bills</p><p className="mt-1">{formatINR(record.billing?.totalBilled ?? 0)}</p>{record.billing?.latestInvoice && <p className="mt-1 text-[10px] text-slate-400">Latest: {record.billing.latestInvoice}</p>}</>
                        ) : key === 'due' && kind === 'customers' ? (
                          <><p className="text-emerald-700">{formatINR(record.billing?.totalPaid ?? 0)} paid</p><p className={`mt-1 font-bold ${(record.billing?.totalDue ?? 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatINR(record.billing?.totalDue ?? 0)} due</p></>
                        ) : String(record[key as keyof ShopRecord] || '—')}
                      </td>
                    ))}
                    {canManage && <td className="px-4 py-3"><div className="flex justify-end">{record.generatedFromSales ? <span className="px-2 text-[10px] text-slate-400">From bills</span> : <><button type="button" aria-label={`Edit ${record.name}`} onClick={() => beginEdit(record)} className="rounded-md p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-700"><Edit2 className="h-4 w-4" /></button><button type="button" aria-label={`Deactivate ${record.name}`} onClick={() => void deactivate(record)} className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"><ToggleLeft className="h-4 w-4" /></button></>}</div></td>}
                  </tr>
                ))}
                {loading && <tr><td colSpan={secondary.length + (canManage ? 2 : 1)} className="p-10 text-center text-slate-500">Loading live records…</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan={secondary.length + (canManage ? 2 : 1)} className="p-10 text-center text-slate-500">No matching {title.toLowerCase()} saved yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
            <div className="mb-5 flex items-center justify-between">
              <div><h3 id="record-form-title" className="text-lg font-black text-slate-900">{editingId ? 'Edit' : 'Add'} {kind === 'customers' ? 'Customer' : 'Supplier'}</h3><p className="mt-1 text-xs text-slate-500">Saved directly to the shop database.</p></div>
              <button type="button" onClick={() => setForm(null)} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {SHOP_RECORD_FIELDS[kind].map((field) => (
                <label key={field.key} className={`block text-xs font-bold text-slate-600 ${field.key === 'address' || field.key === 'notes' ? 'sm:col-span-2' : ''}`}>
                  {field.label}{field.required && ' *'}
                  {field.key === 'notes' || field.key === 'address'
                    ? <textarea required={field.required} maxLength={field.key === 'notes' ? 1000 : 1000} rows={field.key === 'notes' ? 3 : 2} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => current ? { ...current, [field.key]: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400" />
                    : <input required={field.required} maxLength={field.key === 'gstin' ? 15 : 180} type={field.key === 'email' ? 'email' : 'text'} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => current ? { ...current, [field.key]: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400" />}
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save record'}</button>
            </div>
          </form>
        </div>
      )}
    </ShopShell>
  );
}
