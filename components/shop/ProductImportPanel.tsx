'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { useShop } from '@/context/ShopContext';

type ImportError = {
  row: number;
  productCode: string;
  reasons: string[];
};

type PreviewResult = {
  products: Array<Record<string, unknown>>;
  validCount: number;
  errorCount: number;
  errors: ImportError[];
  canImport: boolean;
};

type CurrentUserResponse = {
  user?: {
    role?: string;
  };
};

export default function ProductImportPanel() {
  const { reloadProducts, showToast } = useShop();
  const inputRef = useRef<HTMLInputElement>(null);
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as CurrentUserResponse;
        if (active) setCanManageProducts(
          result.user?.role === 'OWNER' || result.user?.role === 'MANAGER'
        );
      })
      .catch((loadError: unknown) => {
        console.error('Unable to check product import permission:', loadError);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!canManageProducts) return null;

  async function previewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Choose an .xlsx Excel workbook.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The workbook must be no larger than 5 MB.');
      event.target.value = '';
      return;
    }

    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to validate spreadsheet.');
      setPreview(result as PreviewResult);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to validate spreadsheet.');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function importProducts() {
    if (!preview?.canImport) return;
    setError('');
    setIsImporting(true);
    try {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: preview.products }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to import products.');
      await reloadProducts();
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      showToast(`${result.imported} products imported successfully`, 'success');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import products.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Import products from Excel</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Upload an .xlsx workbook, review validation results, then import up to 500 products.
            </p>
            <Link href="/api/products/import/template" download className="mt-1 inline-block text-xs font-bold text-sky-700 hover:text-sky-900">
              Download Excel template
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={previewFile}
            disabled={isPreviewing || isImporting}
            aria-label="Choose Excel product workbook"
            className="max-w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50"
          />
          {preview?.canImport && (
            <button
              type="button"
              onClick={importProducts}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importing…' : `Import ${preview.validCount} products`}
            </button>
          )}
        </div>
      </div>

      {isPreviewing && <p role="status" className="mt-4 text-xs text-slate-500">Checking workbook rows…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

      {preview && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className={`flex items-center gap-2 text-xs font-bold ${preview.canImport ? 'text-emerald-700' : 'text-rose-700'}`}>
            {preview.canImport ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {preview.canImport
              ? `${preview.validCount} rows are valid. Review them, then import.`
              : `${preview.errorCount} row${preview.errorCount === 1 ? '' : 's'} need correction. No products were imported.`}
          </p>
          {preview.errors.length > 0 && (
            <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-rose-100">
              <ul className="divide-y divide-rose-100 text-xs">
                {preview.errors.map((item) => (
                  <li key={`${item.row}-${item.productCode}`} className="px-3 py-2 text-rose-800">
                    <span className="font-bold">Row {item.row}{item.productCode ? ` · ${item.productCode}` : ''}:</span>{' '}
                    {item.reasons.join(' ')}
                  </li>
                ))}
              </ul>
              {preview.errorCount > preview.errors.length && (
                <p className="px-3 py-2 text-xs text-rose-700">Showing the first {preview.errors.length} errors.</p>
              )}
            </div>
          )}
          {preview.canImport && (
            <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2 text-right">Selling price</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.products.slice(0, 8).map((product, index) => (
                    <tr key={`${String(product.sku)}-${index}`}>
                      <td className="px-3 py-2 font-semibold">{String(product.name)}</td>
                      <td className="px-3 py-2 font-mono">{String(product.sku)}</td>
                      <td className="px-3 py-2 text-right">{String(product.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right">{String(product.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.products.length > 8 && <p className="px-3 py-2 text-[10px] text-slate-500">Showing first 8 of {preview.products.length} valid products.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
