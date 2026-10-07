'use client';

import { useCallback, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, Calculator, FileCode2, FileText, RefreshCw } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';
import { formatINR } from '@/lib/utils';

type TallySummary = {
  sales: { billCount: number; grossSales: number; gstAmount: number };
  purchases: { count: number; total: number };
  payments: { count: number; amount: number };
  currentBalances: { customerDue: number; supplierDue: number };
};

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function defaultFromDate() {
  const [year, month, day] = todayInIndia().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 29 * 86_400_000).toISOString().slice(0, 10);
}

export default function TallyPage() {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(todayInIndia);
  const [company, setCompany] = useState('');
  const [summary, setSummary] = useState<TallySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'' | 'masters-xml' | 'vouchers-xml' | 'masters-pdf' | 'vouchers-pdf'>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadTally = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, to });
      const [reportResponse, settingsResponse] = await Promise.all([
        fetch(`/api/reports?${query.toString()}`, { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);
      const report = await reportResponse.json();
      const settings = await settingsResponse.json();
      if (!reportResponse.ok) throw new Error(report.error || 'Unable to load accounting totals.');
      if (!settingsResponse.ok) throw new Error(settings.error || 'Unable to load shop profile.');
      setSummary(report as TallySummary);
      setCompany((current) => current || settings.name || 'MAIN STREAM ELECTRONICS');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load accounting totals.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTally(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadTally]);

  async function downloadExport(format: 'masters' | 'vouchers', fileType: 'xml' | 'pdf') {
    setExporting(`${format}-${fileType}`);
    setError('');
    setMessage('');
    try {
      const query = new URLSearchParams({ from, to, company: company.trim(), format });
      const response = await fetch(`/api/tally/export?${query.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const result: unknown = await response.json();
        const errorMessage = result && typeof result === 'object' && 'error' in result ? String(result.error) : 'Unable to create Tally export.';
        throw new Error(errorMessage);
      }
      const xmlText = await response.text();
      if (!xmlText.trim().startsWith('<?xml') || xmlText.includes('<parsererror')) {
        throw new Error('The Tally export response is not valid XML.');
      }
      const dateRange = `${from}-to-${to}`;
      if (fileType === 'pdf') {
        const parsed = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (parsed.getElementsByTagName('parsererror').length) throw new Error('Unable to read the generated Tally XML for the PDF.');
        const pdf = new jsPDF({ orientation: format === 'vouchers' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const margin = 14;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const displayName = format === 'masters' ? 'Ledger Masters' : 'Vouchers';
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(17);
        pdf.setTextColor(15, 23, 42);
        pdf.text('MAIN STREAM ELECTRONICS', margin, 18);
        pdf.setFontSize(12);
        pdf.setTextColor(2, 132, 199);
        pdf.text(`TallyPrime ${displayName}`, margin, 26);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Company: ${company.trim()}`, margin, 33);
        pdf.text(`Period: ${from} to ${to}`, margin, 38);
        pdf.text('PDF for review/printing only. Use the matching XML file for TallyPrime import.', margin, 43);

        if (format === 'masters') {
          const ledgerRows = Array.from(parsed.getElementsByTagName('LEDGER')).map((item) => [
            item.getElementsByTagName('NAME')[0]?.textContent?.trim() ?? '',
            item.getElementsByTagName('PARENT')[0]?.textContent?.trim() ?? '',
            item.getElementsByTagName('ISBILLWISEON')[0]?.textContent?.trim() ?? 'No',
          ]);
          autoTable(pdf, {
            startY: 50,
            margin: { left: margin, right: margin },
            head: [['Ledger name', 'Under group', 'Bill-wise']],
            body: ledgerRows.length ? ledgerRows : [['No ledgers', '—', '—']],
            theme: 'striped',
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: [51, 65, 85] },
            headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
          });
        } else {
          const vouchers = Array.from(parsed.getElementsByTagName('VOUCHER'));
          const voucherRows = vouchers.map((item) => {
            const entries = Array.from(item.getElementsByTagName('ALLLEDGERENTRIES.LIST'))
              .map((entry) => {
                const name = entry.getElementsByTagName('LEDGERNAME')[0]?.textContent?.trim() ?? '';
                const value = entry.getElementsByTagName('AMOUNT')[0]?.textContent?.trim() ?? '0';
                return `${name}: Rs. ${Math.abs(Number(value)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              })
              .join('\n');
            return [
              item.getElementsByTagName('DATE')[0]?.textContent?.trim() ?? '',
              item.getElementsByTagName('VOUCHERTYPENAME')[0]?.textContent?.trim() ?? '',
              item.getElementsByTagName('VOUCHERNUMBER')[0]?.textContent?.trim() ?? '',
              item.getElementsByTagName('NARRATION')[0]?.textContent?.trim() ?? '',
              entries,
            ];
          });
          autoTable(pdf, {
            startY: 50,
            margin: { left: margin, right: margin },
            head: [['Date', 'Type', 'Voucher no.', 'Narration', 'Ledger entries']],
            body: voucherRows.length ? voucherRows : [['—', '—', '—', 'No vouchers', '—']],
            theme: 'striped',
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85], overflow: 'linebreak' },
            headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 23 }, 2: { cellWidth: 38 }, 3: { cellWidth: 56 }, 4: { cellWidth: 'auto' } },
          });
        }
        const pages = pdf.getNumberOfPages();
        for (let page = 1; page <= pages; page += 1) {
          pdf.setPage(page);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Generated ${new Date().toLocaleString('en-IN')}`, margin, pdf.internal.pageSize.getHeight() - 8);
          pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 8, { align: 'right' });
        }
        pdf.save(`main-stream-tally-${format}-${dateRange}.pdf`);
        setMessage(`${displayName} PDF downloaded. For TallyPrime import, use the corresponding XML download.`);
      } else {
        const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
        const fileName = `main-stream-tally-${format}-${dateRange}.xml`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setMessage(format === 'masters'
          ? 'Ledger masters XML downloaded. Import this file first in TallyPrime, then import the vouchers XML.'
          : 'Voucher XML downloaded. Check the import result in TallyPrime before relying on the entries.');
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to download Tally export.');
    } finally {
      setExporting('');
    }
  }

  const current = summary ?? {
    sales: { billCount: 0, grossSales: 0, gstAmount: 0 },
    purchases: { count: 0, total: 0 },
    payments: { count: 0, amount: 0 },
    currentBalances: { customerDue: 0, supplierDue: 0 },
  };

  return (
    <ShopShell title="Tally">
      <div className="mx-auto max-w-6xl space-y-5 pb-24 lg:pb-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">TallyPrime bridge</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Accounts & Tally Export</h2>
          <p className="mt-1 text-sm text-slate-500">Review live accounting totals and export ledger masters and vouchers for TallyPrime.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">From
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600">To
            <input type="date" value={to} min={from} max={todayInIndia()} onChange={(event) => setTo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">TallyPrime company name (must match exactly)
            <input required maxLength={120} value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name as shown in TallyPrime" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </section>

        <section className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Sales" value={formatINR(current.sales.grossSales)} note={`${current.sales.billCount} invoices`} />
          <SummaryCard label="Purchases" value={formatINR(current.purchases.total)} note={`${current.purchases.count} invoices`} />
          <SummaryCard label="Receipts recorded" value={formatINR(current.payments.amount)} note={`${current.payments.count} payment records`} />
          <SummaryCard label="GST on sales" value={formatINR(current.sales.gstAmount)} note="Combined recorded GST" />
        </section>

        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700"><Calculator className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-sky-950">Export accounting data for TallyPrime</h3>
              <p className="mt-1 text-xs leading-5 text-sky-900">Download two XML files for the selected dates. Import ledger masters first, followed by vouchers. Files contain sales, purchases, customer receipts and purchase payments.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ExportCard title="Ledger masters" onXml={() => void downloadExport('masters', 'xml')} onPdf={() => void downloadExport('masters', 'pdf')} busy={exporting.startsWith('masters')} xmlBusy={exporting === 'masters-xml'} pdfBusy={exporting === 'masters-pdf'} disabled={loading || !!exporting || !company.trim()} />
            <ExportCard title="Vouchers" onXml={() => void downloadExport('vouchers', 'xml')} onPdf={() => void downloadExport('vouchers', 'pdf')} busy={exporting.startsWith('vouchers')} xmlBusy={exporting === 'vouchers-xml'} pdfBusy={exporting === 'vouchers-pdf'} disabled={loading || !!exporting || !company.trim()} />
          </div>
          <button type="button" onClick={() => void loadTally()} disabled={loading || !!exporting} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-sky-800 hover:bg-white disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Updating totals…' : 'Refresh totals'}</button>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-2 text-xs leading-5 text-amber-950">
              <h3 className="font-extrabold">Please review Tally import and GST setup</h3>
              <p>This is an XML file export/import workflow, not a live connection to the Tally application. In TallyPrime, select the matching company and use Import Data for each downloaded file in order. Review the import summary and voucher totals before posting or filing.</p>
              <p>The app does not store your company’s state-wise tax split; GST is exported as combined input/output ledger amounts. Configure the correct CGST/SGST/IGST treatment and tax ledgers in Tally with your accountant before using these figures for statutory GST filing.</p>
              <p>This export carries accounting vouchers and ledgers, not Tally stock-item masters or quantity movements. Inventory quantities remain maintained in this shop app.</p>
              <p>Before importing, take a Tally backup. Re-importing the same files can create duplicates depending on the company’s voucher numbering/import configuration.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <SummaryCard label="Customer balances due now" value={formatINR(current.currentBalances.customerDue)} note="Current outstanding sales invoices" />
          <SummaryCard label="Supplier balances due now" value={formatINR(current.currentBalances.supplierDue)} note="Current outstanding purchase invoices" />
        </section>
        <p className="text-[11px] leading-5 text-slate-500">Report range is limited to 366 days and exports up to 4,999 records of each type per file. Accounting balances reflect saved records only; confirm that your Tally opening balances and ledgers are set up before importing.</p>
      </div>
    </ShopShell>
  );
}

function ExportCard({
  title,
  onXml,
  onPdf,
  busy,
  xmlBusy,
  pdfBusy,
  disabled,
}: {
  title: string;
  onXml: () => void;
  onPdf: () => void;
  busy: boolean;
  xmlBusy: boolean;
  pdfBusy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-sky-100 bg-white p-3">
      <p className="text-xs font-extrabold text-slate-800">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onXml} disabled={disabled || busy} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 disabled:opacity-50">
          <FileCode2 className="h-3.5 w-3.5" />{xmlBusy ? 'Preparing…' : 'XML · Tally import'}
        </button>
        <button type="button" onClick={onPdf} disabled={disabled || busy} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-2 py-2 text-[10px] font-bold text-white hover:bg-sky-700 disabled:opacity-50">
          <FileText className="h-3.5 w-3.5" />{pdfBusy ? 'Preparing…' : 'PDF · View / print'}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 break-words text-lg font-black tracking-tight text-slate-900 sm:text-xl">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></article>;
}
