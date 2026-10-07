import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';

export default function ModulePreview({
  title,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <ShopShell title={title}>
      <div className="mx-auto max-w-5xl space-y-5 pb-20 lg:pb-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Shop management</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{title}</h2>
        </div>
        <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Icon className="h-5 w-5" /></span>
          <h3 className="mt-4 text-sm font-extrabold text-slate-800">{title}</h3>
          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">No live {title.toLowerCase()} records are available. This module is not connected to the database yet, so no sample business data is shown.</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500"><Construction className="h-3.5 w-3.5" /> No live records</span>
        </section>
      </div>
    </ShopShell>
  );
}
