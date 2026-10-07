'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Edit2, Package, Plus, Search, ToggleLeft } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { useShop } from '@/context/ShopContext';
import { formatINR } from '@/lib/utils';
import ProductImportPanel from '@/components/shop/ProductImportPanel';

export default function ProductsPage() {
  const { products, productsLoading, productsError, deleteProduct, showToast } = useShop();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.category, product.brand, product.hsnCode]
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [products, search]);

  return (
    <ShopShell title="Products">
      <div className="mx-auto max-w-7xl space-y-5 pb-20 lg:pb-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Catalog & inventory</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Products</h2>
            <p className="mt-1 text-sm text-slate-500">Text-only records saved in the shop catalog</p>
          </div>
          <Link href="/products/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-600">
            <Plus className="h-4 w-4" /> Add Product
          </Link>
        </div>

        <ProductImportPanel />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard label="Total products" value={products.length} icon={<Package className="h-4 w-4" />} />
          <SummaryCard label="Low stock" value={products.filter((product) => product.stock > 0 && product.stock <= product.minStock).length} icon={<ToggleLeft className="h-4 w-4" />} />
          <SummaryCard label="Out of stock" value={products.filter((product) => product.stock === 0).length} icon={<Package className="h-4 w-4" />} />
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <label className="relative block max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, category, brand or HSN" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product / Code</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3 text-right">Purchase</th><th className="px-4 py-3 text-right">Selling</th>
                  <th className="px-4 py-3 text-center">GST</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5"><p className="max-w-sm truncate font-bold text-slate-900">{product.name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{product.sku} · HSN {product.hsnCode}</p></td>
                    <td className="px-4 py-3.5 text-slate-600">{product.category}</td>
                    <td className="px-4 py-3.5 text-slate-600">{product.brand}</td>
                    <td className="px-4 py-3.5 text-right">{formatINR(product.purchasePrice)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">{formatINR(product.sellingPrice)}</td>
                    <td className="px-4 py-3.5 text-center">{product.gstRate}%</td>
                    <td className="px-4 py-3.5 text-right"><span className={product.stock <= product.minStock ? 'font-bold text-amber-700' : 'text-slate-700'}>{product.stock}</span><span className="text-slate-400"> / {product.minStock}</span></td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link href={`/products/${encodeURIComponent(product.id)}/edit`} aria-label={`Edit ${product.name}`} className="rounded-md p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-700"><Edit2 className="h-4 w-4" /></Link>
                        <button type="button" onClick={() => {
                          if (!window.confirm(`Deactivate ${product.name}? It will no longer appear in active products or billing.`)) return;
                          void deleteProduct(product.id).catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Unable to deactivate product', 'error'));
                        }} aria-label={`Deactivate ${product.name}`} className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"><ToggleLeft className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {productsLoading && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Loading products…</td></tr>}
                {!productsLoading && productsError && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-rose-600">{productsError}</td></tr>}
                {!productsLoading && !productsError && !filtered.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">No products saved yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ShopShell>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">{icon}</span><div><p className="text-[11px] text-slate-500">{label}</p><p className="text-lg font-black text-slate-900">{value}</p></div></div>;
}
