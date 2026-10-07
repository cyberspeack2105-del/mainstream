'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { useShop } from '@/context/ShopContext';
import { formatINR } from '@/lib/utils';

type Supplier = { id: string; name: string };
type Purchase = { id: string; invoiceNumber: string; supplierName: string; grandTotal: number; balanceAmount: number; date: string };
type Movement = { id: string; productName: string; type: string; quantity: number; reason: string; createdAt: string };
type PurchaseLine = { productId: string; quantity: number; purchasePrice: number };

export default function PurchaseStockPage({ mode }: { mode: 'purchases' | 'stock' }) {
  const isPurchase = mode === 'purchases';
  const title = isPurchase ? 'Purchase' : 'Stock';
  const { products, reloadProducts } = useShop();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [records, setRecords] = useState<Array<Purchase | Movement>>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([{ productId: '', quantity: 1, purchasePrice: 0 }]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<'ADD' | 'REMOVE' | 'SET'>('ADD');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadRecords() {
    const response = await fetch(`/api/${mode}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Unable to load ${title.toLowerCase()}.`);
    setRecords(result as Array<Purchase | Movement>);
  }

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void loadRecords().catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : `Unable to load ${title.toLowerCase()}.`);
      });
    }, 0);
    if (isPurchase) {
      fetch('/api/suppliers', { cache: 'no-store' })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Unable to load suppliers.');
          if (active) setSuppliers(result as Supplier[]);
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load suppliers.');
        });
    }
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [mode, isPurchase, title]);

  function addLine() {
    setLines((current) => [...current, { productId: '', quantity: 1, purchasePrice: 0 }]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const body = isPurchase
      ? { supplierId, invoiceNumber, items: lines.map((line) => ({ ...line, gstRate: products.find((product) => product.id === line.productId)?.gstRate })), paidAmount }
      : { productId, type, quantity, reason };
    try {
      const response = await fetch(`/api/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to save ${title.toLowerCase()} record.`);
      await Promise.all([loadRecords(), reloadProducts()]);
      setInvoiceNumber('');
      setReason('');
      if (isPurchase) {
        setLines([{ productId: '', quantity: 1, purchasePrice: 0 }]);
        setPaidAmount(0);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Unable to save ${title.toLowerCase()} record.`);
    } finally {
      setLoading(false);
    }
  }

  const purchaseTotal = lines.reduce((sum, line) => {
    const gstRate = products.find((product) => product.id === line.productId)?.gstRate ?? 0;
    return sum + line.quantity * line.purchasePrice * (1 + gstRate / 100);
  }, 0);

  return (
    <ShopShell title={title}>
      <div className="mx-auto max-w-7xl space-y-5 pb-20 lg:pb-0">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Live inventory operations</p><h2 className="mt-1 text-2xl font-black text-slate-900">{isPurchase ? 'Supplier Purchases' : 'Stock Control'}</h2><p className="mt-1 text-sm text-slate-500">{isPurchase ? 'Record received invoices; stock quantities update in the same database transaction.' : 'Adjust on-hand quantity with an auditable reason and movement history.'}</p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <div className="grid items-start gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-extrabold text-slate-900">{isPurchase ? 'Record purchase invoice' : 'Adjust stock'}</h3>
            {isPurchase ? (
              <>
                <label className="block text-xs font-bold text-slate-600">Supplier *
                  <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
                </label>
                <label className="block text-xs font-bold text-slate-600">Supplier invoice number *
                  <input required maxLength={100} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <div className="space-y-3">{lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3">
                    <label className="col-span-2 text-xs font-bold text-slate-600">Product
                      <select required value={line.productId} onChange={(event) => {
                        const nextProduct = products.find((product) => product.id === event.target.value);
                        setLines((current) => current.map((item, i) => i === index ? { ...item, productId: event.target.value, purchasePrice: nextProduct?.purchasePrice ?? 0 } : item));
                      }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">Quantity
                      <input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">Unit purchase price
                      <input required type="number" min="0" step="0.01" value={line.purchasePrice} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, purchasePrice: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </label>
                  </div>
                ))}</div>
                <button type="button" onClick={addLine} className="text-xs font-bold text-sky-700"><Plus className="mr-1 inline h-3.5 w-3.5" />Add product line</button>
                <label className="block text-xs font-bold text-slate-600">Amount paid
                  <input type="number" min="0" step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <p className="text-xs font-bold text-slate-700">Invoice estimate (incl. GST): {formatINR(purchaseTotal)}</p>
              </>
            ) : (
              <>
                <label className="block text-xs font-bold text-slate-600">Product *
                  <select required value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · Stock {product.stock}</option>)}</select>
                </label>
                <label className="block text-xs font-bold text-slate-600">Adjustment type
                  <select value={type} onChange={(event) => setType(event.target.value as 'ADD' | 'REMOVE' | 'SET')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="ADD">Add units</option><option value="REMOVE">Remove units</option><option value="SET">Set exact stock count</option></select>
                </label>
                <label className="block text-xs font-bold text-slate-600">{type === 'SET' ? 'New stock quantity' : 'Quantity'}
                  <input type="number" min="0" step="1" required value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-xs font-bold text-slate-600">Reason *
                  <textarea required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" rows={3} />
                </label>
              </>
            )}
            <button type="submit" disabled={loading || !products.length || (isPurchase && !suppliers.length)} className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-sky-600 disabled:opacity-50">{loading ? 'Saving…' : isPurchase ? 'Save purchase & update stock' : 'Save stock adjustment'}</button>
            {!products.length && <p className="text-xs text-amber-700">Add active products before recording this operation.</p>}
            {isPurchase && !suppliers.length && <p className="text-xs text-amber-700">Add a supplier before recording a purchase.</p>}
          </form>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-extrabold text-slate-900">{isPurchase ? 'Purchase history' : 'Stock movement history'}</h3><p className="mt-1 text-xs text-slate-500">{records.length} latest records</p></div><button type="button" aria-label="Refresh records" onClick={() => void loadRecords()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button></div>
            <div className="max-h-[70vh] overflow-auto">
              {isPurchase ? (records as Purchase[]).map((purchase) => <div key={purchase.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 text-xs"><div><p className="font-bold text-slate-900">{purchase.invoiceNumber} · {purchase.supplierName}</p><p className="mt-1 text-slate-500">{new Date(purchase.date).toLocaleDateString()}</p></div><div className="text-right"><p className="font-bold">{formatINR(purchase.grandTotal)}</p><p className="mt-1 text-amber-700">Due {formatINR(purchase.balanceAmount)}</p></div></div>) : (records as Movement[]).map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 text-xs"><div><p className="font-bold text-slate-900">{movement.productName} · {movement.type}</p><p className="mt-1 text-slate-500">{movement.reason}</p></div><div className="text-right"><p className={`font-black ${movement.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</p><p className="mt-1 text-slate-400">{new Date(movement.createdAt).toLocaleDateString()}</p></div></div>)}
              {!records.length && !loading && <p className="p-10 text-center text-sm text-slate-500">No live records yet.</p>}
              {loading && <p className="p-10 text-center text-sm text-slate-500">Loading live records…</p>}
            </div>
          </section>
        </div>
      </div>
    </ShopShell>
  );
}
