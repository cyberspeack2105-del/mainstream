'use client';

import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, MessageCircle, Minus, Plus, Printer, Search, Trash2 } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { useShop } from '@/context/ShopContext';
import { formatINR } from '@/lib/utils';
import type { Product } from '@/types';

type Customer = { id: string; name: string; phone: string };
type ShopProfile = { name: string; address: string; phone: string; email: string; gstin: string; upiId: string };
type InvoiceItem = { productName: string; sku: string; quantity: number; unitPrice: number; hsnCode: string; gstRate: number; total: number };
type Sale = {
  id: string;
  invoiceNumber: string;
  shopProfile?: ShopProfile;
  customerName: string;
  customerPhone: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  gstAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentStatus: string;
  notes: string;
};

const defaultProfile: ShopProfile = {
  name: 'MAIN STREAM ELECTRONICS',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  upiId: '',
};

export default function NewBillPage() {
  const { products, reloadProducts } = useShop();
  const [query, setQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paidEdited, setPaidEdited] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [invoiceAction, setInvoiceAction] = useState<'download' | 'print' | 'whatsapp' | ''>('');
  const [invoiceMessage, setInvoiceMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/settings', { cache: 'no-store' }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load shop settings.');
        return result as ShopProfile;
      }),
      fetch('/api/customers', { cache: 'no-store' }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load customers.');
        return result as Customer[];
      }),
    ]).then(([shopProfile, customerRecords]) => {
      if (active) {
        setProfile({ ...defaultProfile, ...shopProfile });
        setCustomers(customerRecords);
      }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load checkout information.');
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) =>
      !term || `${product.name} ${product.sku} ${product.barcode} ${product.category}`.toLowerCase().includes(term)
    );
  }, [products, query]);
  const selectedItems = products
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => ({ product, quantity: quantities[product.id] }));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxableAmount = Math.max(0, subtotal - safeDiscount);
  const gst = selectedItems.reduce(
    (sum, item) => sum + ((item.product.sellingPrice * item.quantity) / Math.max(1, subtotal)) * taxableAmount * (item.product.gstRate / 100),
    0
  );
  const grandTotal = Math.round((taxableAmount + gst) * 100) / 100;
  const safePaid = Math.min(Math.max(0, paidEdited ? paid : grandTotal), grandTotal);
  const balance = Math.max(0, grandTotal - safePaid);

  function setQuantity(productId: string, quantity: number) {
    setQuantities((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  async function completeSale() {
    if (!selectedItems.length) {
      setError('Add at least one product before completing the bill.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          discount: safeDiscount,
          paidAmount: safePaid,
          paymentMethod,
          notes: notes.trim(),
          customerId: customerId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to complete sale.');
      setSale(result as Sale);
      await reloadProducts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to complete sale.');
    } finally {
      setSaving(false);
    }
  }

  function startNewBill() {
    setSale(null);
    setQuantities({});
    setDiscount(0);
    setPaid(0);
    setPaidEdited(false);
    setPaymentMethod('Cash');
    setNotes('');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setError('');
    setInvoiceMessage('');
  }

  async function createInvoicePdf(invoice: Sale) {
    const pdf = new jsPDF();
    const invoiceProfile = invoice.shopProfile ?? profile;
    const margin = 14;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`;
    pdf.setFillColor(224, 242, 254);
    pdf.rect(0, 0, pageWidth, 46, 'F');
    pdf.setFillColor(14, 165, 233);
    pdf.roundedRect(margin, 9, 17, 17, 2, 2, 'F');
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(2);
    pdf.line(margin + 11, 11, margin + 7, 17);
    pdf.line(margin + 7, 17, margin + 10, 17);
    pdf.line(margin + 10, 17, margin + 7, 24);
    pdf.line(margin + 7, 24, margin + 14, 16);
    pdf.line(margin + 14, 16, margin + 11, 16);
    pdf.line(margin + 11, 16, margin + 13, 11);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(invoiceProfile.name, margin + 23, 16, { maxWidth: pageWidth - margin * 2 - 23 });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const shopDetails = [invoiceProfile.address, invoiceProfile.phone, invoiceProfile.email, invoiceProfile.gstin ? `GSTIN: ${invoiceProfile.gstin}` : ''].filter(Boolean);
    if (shopDetails.length) pdf.text(shopDetails.join('  |  '), margin + 23, 22, { maxWidth: pageWidth - margin * 2 - 23 });
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(2, 132, 199);
    pdf.setFontSize(12);
    pdf.text('TAX INVOICE', pageWidth - margin, 39, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(8);
    pdf.text(`Invoice: ${invoice.invoiceNumber}`, margin, 39);
    pdf.setTextColor(15, 23, 42);

    let y = 53;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(2, 132, 199);
    pdf.text('CUSTOMER', margin, y);
    pdf.text('BILL DETAILS', pageWidth / 2 + 5, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(9);
    pdf.text(invoice.customerName, margin, y);
    if (invoice.customerPhone) pdf.text(`Mobile: ${invoice.customerPhone}`, margin, y + 5);
    pdf.text(`Invoice date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, pageWidth / 2 + 5, y);
    pdf.text(`Payment: ${invoice.paymentMethod} - ${invoice.paymentStatus}`, pageWidth / 2 + 5, y + 5);
    y += 20;

    const taxableBase = Math.max(0, invoice.subtotal - invoice.discount);
    const invoiceRows = invoice.items.map((item, index) => {
      const taxable = invoice.subtotal > 0 ? item.total * taxableBase / invoice.subtotal : 0;
      const tax = taxable * item.gstRate / 100;
      return [
        String(index + 1),
        `${item.productName}\n${item.sku}`,
        item.hsnCode || '-',
        String(item.quantity),
        currency(item.unitPrice),
        currency(taxable),
        `${item.gstRate}%`,
        currency(tax),
        currency(taxable + tax),
      ];
    });
    const invoiceTotalRow = (label: string, value: string, emphasize = false) => [
      {
        content: label,
        colSpan: 8,
        styles: {
          halign: 'right' as const,
          fontStyle: emphasize ? 'bold' as const : 'normal' as const,
          fillColor: emphasize ? [224, 242, 254] as [number, number, number] : [255, 255, 255] as [number, number, number],
          textColor: emphasize ? [15, 23, 42] as [number, number, number] : [51, 65, 85] as [number, number, number],
        },
      },
      {
        content: value,
        styles: {
          halign: 'right' as const,
          fontStyle: emphasize ? 'bold' as const : 'normal' as const,
          fillColor: emphasize ? [224, 242, 254] as [number, number, number] : [255, 255, 255] as [number, number, number],
          textColor: emphasize ? [15, 23, 42] as [number, number, number] : [51, 65, 85] as [number, number, number],
        },
      },
    ];
    const totalRows = [
      invoiceTotalRow('SUBTOTAL', currency(invoice.subtotal)),
      invoiceTotalRow('DISCOUNT', `- ${currency(invoice.discount)}`),
      invoiceTotalRow('GST TOTAL', currency(invoice.gstAmount)),
      invoiceTotalRow('GRAND TOTAL', currency(invoice.grandTotal), true),
      invoiceTotalRow(`PAID (${invoice.paymentMethod.toUpperCase()})`, currency(invoice.paidAmount)),
      invoiceTotalRow('BALANCE DUE', currency(invoice.balanceAmount), true),
    ];
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 22, top: 16 },
      head: [['#', 'Product / Description', 'HSN', 'Qty', 'Rate', 'Taxable', 'GST %', 'Tax', 'Amount']],
      body: [...invoiceRows, ...totalRows],
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], lineColor: [203, 213, 225], lineWidth: 0.2, valign: 'middle' },
      headStyles: { fillColor: [56, 189, 248], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 15 },
        3: { cellWidth: 9, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 12, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' },
        8: { cellWidth: 20, halign: 'right' },
      },
      didDrawPage: () => {
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(2, 132, 199);
        pdf.text('MAIN STREAM ELECTRONICS', margin, pageHeight - 10);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Thank you for choosing us. We wish you a happy and safe experience.', margin + 39, pageHeight - 10);
        pdf.text(`Page ${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      },
    });

    let footerY = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    if (invoice.paymentReference) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`UPI transaction reference: ${invoice.paymentReference}`, margin, footerY);
      footerY += 5;
    }
    if (invoice.notes) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      const noteLines = pdf.splitTextToSize(`Notes: ${invoice.notes}`, pageWidth - margin * 2);
      pdf.text(noteLines, margin, footerY);
      footerY += noteLines.length * 4 + 3;
    }
    if (footerY > 260) {
      pdf.addPage();
      footerY = 20;
    }
    pdf.setTextColor(2, 132, 199);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Electrical & Plumbing Solutions', margin, footerY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(8);
    pdf.text('Quality supplies, expert installation and dependable service.', margin, footerY + 5);
    pdf.setTextColor(2, 132, 199);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Thank you for choosing Main Stream Electronics!', margin, footerY + 11);
    return pdf;
  }

  async function downloadInvoice(invoice: Sale) {
    const pdf = await createInvoicePdf(invoice);
    pdf.save(`${invoice.invoiceNumber}.pdf`);
  }

  async function printInvoice(invoice: Sale) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) throw new Error('Allow pop-ups to open and print the invoice.');
    const pdf = await createInvoicePdf(invoice);
    printWindow.location.href = pdf.output('bloburl').toString();
    window.setTimeout(() => printWindow.print(), 1200);
  }

  function whatsappMessage(invoice: Sale) {
    return `Hello ${invoice.customerName}, invoice ${invoice.invoiceNumber} from ${invoice.shopProfile?.name ?? profile.name}. Total: ${formatINR(invoice.grandTotal)} | Paid: ${formatINR(invoice.paidAmount)} | Balance: ${formatINR(invoice.balanceAmount)}.`;
  }

  function whatsappUrl(invoice: Sale) {
    const message = whatsappMessage(invoice);
    if (!invoice.customerPhone) return `https://wa.me/?text=${encodeURIComponent(message)}`;
    const digits = invoice.customerPhone.replace(/\D/g, '');
    const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  async function sendInvoiceWhatsApp(invoice: Sale) {
    const pdf = await createInvoicePdf(invoice);
    const file = new File([pdf.output('blob')], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
    const shareData = { files: [file], title: `Invoice ${invoice.invoiceNumber}`, text: whatsappMessage(invoice) };
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      return 'shared';
    }
    pdf.save(`${invoice.invoiceNumber}.pdf`);
    window.open(whatsappUrl(invoice), '_blank', 'noopener,noreferrer');
    return 'fallback';
  }

  async function runInvoiceAction(action: 'download' | 'print' | 'whatsapp', invoice: Sale) {
    setInvoiceAction(action);
    setError('');
    setInvoiceMessage('');
    try {
      if (action === 'download') {
        await downloadInvoice(invoice);
      } else if (action === 'print') {
        await printInvoice(invoice);
      } else {
        const result = await sendInvoiceWhatsApp(invoice);
        setInvoiceMessage(result === 'shared'
          ? 'Invoice PDF and message opened in your device share sheet. Choose WhatsApp and the customer, then tap Send.'
          : 'WhatsApp chat opened and the invoice PDF was downloaded separately. Attach the downloaded PDF in WhatsApp, then tap Send. This browser cannot attach files to WhatsApp automatically.');
      }
    } catch (actionError) {
      if (actionError instanceof Error && actionError.name === 'AbortError') {
        setInvoiceMessage('Sharing was cancelled. The invoice has not been sent.');
        return;
      }
      setError(actionError instanceof Error ? actionError.message : 'Unable to prepare invoice action.');
    } finally {
      setInvoiceAction('');
    }
  }

  return (
    <ShopShell title="New Bill">
      <div className="mx-auto max-w-7xl space-y-5 pb-20 lg:pb-0">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Quick Bill</h2>
          <p className="mt-1 text-sm text-slate-500">Create a live sale, record payment, and download the automatic invoice as PDF.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {sale && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div>
              <p className="text-sm font-extrabold text-emerald-900">Sale saved · Invoice {sale.invoiceNumber}</p>
              <p className="mt-1 text-xs text-emerald-800">Payment and bill notes are recorded. Remaining due: {formatINR(sale.balanceAmount)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!invoiceAction} onClick={() => void runInvoiceAction('download', sale)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Download className="h-4 w-4" />{invoiceAction === 'download' ? 'Preparing…' : 'Download PDF'}</button>
              <button type="button" disabled={!!invoiceAction} onClick={() => void runInvoiceAction('print', sale)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 disabled:opacity-50"><Printer className="h-4 w-4" />{invoiceAction === 'print' ? 'Opening…' : 'Print invoice'}</button>
              <button type="button" disabled={!!invoiceAction} onClick={() => void runInvoiceAction('whatsapp', sale)} className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1fb85a] disabled:opacity-50"><MessageCircle className="h-4 w-4" />{invoiceAction === 'whatsapp' ? 'Preparing…' : 'Share PDF to WhatsApp'}</button>
              <button type="button" onClick={startNewBill} className="rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800">New bill</button>
            </div>
          </section>
        )}
        {invoiceMessage && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">{invoiceMessage}</p>}

        <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <label className="relative block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product name, code or category" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
              </label>
              <p className="mt-2 text-[11px] text-slate-400">{visibleProducts.length} products · live stock</p>
            </div>
            <div className="grid max-h-[65vh] gap-2 overflow-y-auto p-3 sm:grid-cols-2">
              {visibleProducts.map((product: Product) => {
                const quantity = quantities[product.id] ?? 0;
                return (
                  <article key={product.id} className="flex min-h-28 items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-200">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{product.name}</h3>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{product.sku} · {product.category}</p>
                      <p className="mt-2 text-sm font-extrabold text-sky-700">{formatINR(product.sellingPrice)}</p>
                      <p className={`mt-0.5 text-[10px] font-semibold ${product.stock === 0 ? 'text-rose-600' : 'text-slate-500'}`}>{product.stock} in stock</p>
                    </div>
                    {quantity > 0 ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => setQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-6 text-center text-sm font-extrabold">{quantity}</span>
                        <button type="button" disabled={quantity >= product.stock} onClick={() => setQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name}`} className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500 text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button type="button" disabled={product.stock < 1} onClick={() => setQuantity(product.id, 1)} aria-label={`Add ${product.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                    )}
                  </article>
                );
              })}
              {!visibleProducts.length && <p className="col-span-full p-8 text-center text-sm text-slate-500">No matching products.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h3 className="text-sm font-extrabold text-slate-900">Current Bill</h3><p className="mt-1 text-xs text-slate-500">{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} items selected</p></div>
              <button type="button" onClick={() => setQuantities({})} disabled={!selectedItems.length || !!sale} className="text-xs font-bold text-slate-500 hover:text-rose-600 disabled:opacity-40">Clear</button>
            </div>
            <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto px-5">
              {selectedItems.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{product.name}</p><p className="mt-1 text-[10px] text-slate-500">{formatINR(product.sellingPrice)} × {quantity}</p></div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!!sale} onClick={() => setQuantity(product.id, quantity - 1)} aria-label="Decrease quantity" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-5 text-center text-xs font-bold">{quantity}</span>
                    <button type="button" disabled={!!sale || quantity >= product.stock} onClick={() => setQuantity(product.id, quantity + 1)} aria-label="Increase quantity" className="rounded p-1 text-sky-700 hover:bg-sky-50 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={!!sale} onClick={() => setQuantity(product.id, 0)} aria-label={`Remove ${product.name}`} className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-bold">{formatINR(product.sellingPrice * quantity)}</span>
                </div>
              ))}
              {!selectedItems.length && <p className="py-9 text-center text-xs text-slate-400">Selected products appear here.</p>}
            </div>
            <div className="space-y-4 border-t border-slate-100 p-5">
              <label className="block text-[11px] font-bold text-slate-600">Customer (optional)
                <select disabled={!!sale} value={customerId} onChange={(event) => {
                  const nextCustomerId = event.target.value;
                  const selectedCustomer = customers.find((customer) => customer.id === nextCustomerId);
                  setCustomerId(nextCustomerId);
                  setCustomerName(selectedCustomer?.name ?? '');
                  setCustomerPhone(selectedCustomer?.phone ?? '');
                }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal">
                  <option value="">Walk-in customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-slate-600">Customer name
                  <input disabled={!!sale || !!customerId} maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Walk-in customer" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">Mobile number
                  <input disabled={!!sale || !!customerId} type="tel" inputMode="tel" maxLength={30} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="For WhatsApp invoice" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
                </label>
              </div>
              {!sale && <p className="text-[10px] leading-4 text-slate-500">Selecting an existing customer fills these details. For WhatsApp, include the country code if it is not an Indian mobile number.</p>}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-slate-600">Discount (Rs.)
                  <input disabled={!!sale} type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">Paid now (Rs.)
                  <input disabled={!!sale} type="number" min="0" max={grandTotal} step="0.01" value={paidEdited ? paid : grandTotal} onChange={(event) => {
                    setPaid(Number(event.target.value) || 0);
                    setPaidEdited(true);
                  }} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-600">Payment method
                <select disabled={!!sale} value={paymentMethod} onChange={(event) => {
                  setPaymentMethod(event.target.value);
                }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal">
                  <option>Cash</option><option>GPay / QR</option>
                </select>
              </label>
              {!sale && <p className="text-[10px] leading-4 text-slate-500">Payment method is saved as a record only. No QR is generated and no payment is processed here; verify GPay/QR payments separately.</p>}
              <label className="block text-[11px] font-bold text-slate-600">Bill / payment notes
                <textarea disabled={!!sale} maxLength={1000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note for this sale or payment" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" />
              </label>
              <div className="space-y-2 border-t border-dashed border-slate-200 pt-3 text-xs">
                <BillLine label="Subtotal" value={formatINR(subtotal)} />
                <BillLine label="Discount" value={`− ${formatINR(safeDiscount)}`} />
                <BillLine label="GST" value={formatINR(gst)} />
                <BillLine label="Grand Total" value={formatINR(grandTotal)} strong />
                <BillLine label="Paid" value={formatINR(safePaid)} positive />
                <BillLine label="Balance" value={formatINR(balance)} warning />
              </div>
              {!sale && <button type="button" onClick={() => void completeSale()} disabled={saving || !selectedItems.length} className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-sky-600 disabled:opacity-50">{saving ? 'Saving sale…' : 'COMPLETE SALE & GENERATE INVOICE'}</button>}
              <p className="text-center text-[10px] text-slate-400">Invoice number, payment record, bill notes, and stock update are saved automatically.</p>
            </div>
          </section>
        </div>
      </div>
    </ShopShell>
  );
}

function BillLine({
  label,
  value,
  strong,
  positive,
  warning,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t border-slate-100 pt-2 text-sm font-black text-slate-900' : positive ? 'font-semibold text-emerald-700' : warning ? 'font-bold text-amber-700' : 'text-slate-600'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
