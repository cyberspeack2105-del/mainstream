'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { useShop } from '@/context/ShopContext';
import type { Product } from '@/types';

type ProductForm = Pick<Product, 'name' | 'sku' | 'category' | 'brand' | 'purchasePrice' | 'sellingPrice' | 'mrp' | 'gstRate' | 'hsnCode' | 'stock' | 'minStock' | 'barcode' | 'warranty'>;

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  category: '',
  brand: '',
  purchasePrice: 0,
  sellingPrice: 0,
  mrp: 0,
  gstRate: 18,
  hsnCode: '',
  stock: 0,
  minStock: 0,
  barcode: '',
  warranty: '',
};

export default function ProductFormPage({ productId }: { productId?: string }) {
  const router = useRouter();
  const { addProduct, updateProduct, deleteProduct } = useShop();
  const editingId = productId ?? null;
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    fetch(`/api/products/${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load product');
        if (active) {
          setForm({
            name: result.name,
            sku: result.sku,
            category: result.category,
            brand: result.brand,
            purchasePrice: result.purchasePrice,
            sellingPrice: result.sellingPrice,
            mrp: result.mrp,
            gstRate: result.gstRate,
            hsnCode: result.hsnCode,
            stock: result.stock,
            minStock: result.minStock,
            barcode: result.barcode ?? '',
            warranty: result.warranty ?? '',
          });
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          const message = loadError instanceof Error ? loadError.message : 'Unable to load product';
          setLoadError(message);
          setError(message);
        }
      })
      .finally(() => {
        if (active) setLoadingProduct(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = {
      ...form,
      sku: form.sku.trim() || `MSE-${Date.now().toString().slice(-6)}`,
      discountPercentage: form.mrp > 0 ? Math.max(0, Math.round(((form.mrp - form.sellingPrice) / form.mrp) * 100)) : 0,
      inStock: form.stock > 0,
    };
    try {
      if (editingId) await updateProduct(editingId, data);
      else await addProduct(data);
      router.push('/products');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product');
    }
  }

  async function deactivateProduct() {
    if (!editingId || !window.confirm(`Deactivate "${form.name}"? It will be removed from active products but retained in past sales and reports.`)) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProduct(editingId);
      router.push('/products');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to deactivate product.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ShopShell title={editingId ? 'Edit Product' : 'Add Product'}>
      <div className="mx-auto max-w-3xl space-y-5 pb-20 lg:pb-0">
        <div className="flex items-center gap-3">
          <Link href="/products" aria-label="Back to products" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-sky-700"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{editingId ? 'Edit Product' : 'Add Product'}</h2>
            <p className="mt-1 text-sm text-slate-500">Text-only product details · saved to the shop catalog</p>
          </div>
        </div>

        <form onSubmit={saveProduct} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
          {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {loadingProduct && <p className="mb-4 text-sm text-slate-500">Loading product details…</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Product Name" className="sm:col-span-2">
              <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className={inputClass} placeholder="e.g. LED Bulb 9W Cool White" />
            </FormField>
            <FormField label="Product Code">
              <input value={form.sku} onChange={(event) => updateField('sku', event.target.value)} className={inputClass} placeholder="Auto-generated if empty" />
            </FormField>
            <FormField label="Category">
              <input required value={form.category} onChange={(event) => updateField('category', event.target.value)} className={inputClass} placeholder="e.g. Lighting" />
            </FormField>
            <FormField label="Brand">
              <input required value={form.brand} onChange={(event) => updateField('brand', event.target.value)} className={inputClass} placeholder="Brand name" />
            </FormField>
            <FormField label="HSN">
              <input required value={form.hsnCode} onChange={(event) => updateField('hsnCode', event.target.value)} className={inputClass} placeholder="HSN code" />
            </FormField>
            <FormField label="Purchase Price (₹)">
              <input type="number" min="0" step="0.01" required value={form.purchasePrice} onChange={(event) => updateField('purchasePrice', Number(event.target.value))} className={inputClass} />
            </FormField>
            <FormField label="Selling Price (₹)">
              <input type="number" min="0" step="0.01" required value={form.sellingPrice} onChange={(event) => updateField('sellingPrice', Number(event.target.value))} className={inputClass} />
            </FormField>
            <FormField label="MRP (₹)">
              <input type="number" min="0" step="0.01" required value={form.mrp} onChange={(event) => updateField('mrp', Number(event.target.value))} className={inputClass} />
            </FormField>
            <FormField label="GST">
              <select value={form.gstRate} onChange={(event) => updateField('gstRate', Number(event.target.value))} className={`${inputClass} bg-white`}>
                {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
              </select>
            </FormField>
            <FormField label="Stock">
              <input type="number" min="0" step="1" required value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className={inputClass} />
            </FormField>
            <FormField label="Minimum Stock">
              <input type="number" min="0" step="1" required value={form.minStock} onChange={(event) => updateField('minStock', Number(event.target.value))} className={inputClass} />
            </FormField>
            <FormField label="Barcode">
              <input value={form.barcode ?? ''} onChange={(event) => updateField('barcode', event.target.value)} className={inputClass} maxLength={80} />
            </FormField>
            <FormField label="Warranty">
              <input value={form.warranty ?? ''} onChange={(event) => updateField('warranty', event.target.value)} className={inputClass} maxLength={120} placeholder="e.g. 1 year" />
            </FormField>
          </div>

          <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row">
            {editingId ? (
              <button type="button" onClick={() => void deactivateProduct()} disabled={loadingProduct || deleting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{deleting ? 'Deactivating…' : 'Delete Product'}
              </button>
            ) : <span />}
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Link href="/products" className="rounded-lg border border-slate-200 px-4 py-2.5 text-center text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</Link>
              <button type="submit" disabled={loadingProduct || Boolean(loadError) || deleting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{editingId ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </div>
        </form>
      </div>
    </ShopShell>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block text-xs font-bold text-slate-600 ${className}`}>{label}{children}</label>;
}
