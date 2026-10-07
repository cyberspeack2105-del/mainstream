'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  Calculator,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Settings,
  Truck,
  Users,
  Zap,
  LogOut,
  X,
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Bill', href: '/billing', icon: Plus },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Purchase', href: '/purchases', icon: Truck },
  { label: 'Stock', href: '/stock', icon: Boxes },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Suppliers', href: '/suppliers', icon: Truck },
  { label: 'Due', href: '/due', icon: CreditCard },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Tally', href: '/tally', icon: Calculator },
  { label: 'AI Assistant', href: '/ai', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function ShopShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const primaryMobileItems = [navItems[0], navItems[1], navItems[2], navItems[4]];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  async function signOut() {
    setSignOutError('');
    setIsSigningOut(true);
    setMobileMenuOpen(false);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Unable to sign out');
      }
      router.replace('/login');
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out');
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white xl:flex">
        <Link href="/dashboard" className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white">
            <Zap className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-black tracking-tight">MAIN STREAM</span>
            <span className="block text-[10px] font-bold tracking-[0.16em] text-sky-600">ELECTRONICS</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button onClick={signOut} disabled={isSigningOut} className="hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 xl:flex">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 xl:pl-64">
        <header className="sticky top-0 z-40 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:gap-4 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation-drawer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 xl:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600">Shop management</p>
              <h1 className="truncate text-sm font-extrabold text-slate-900">{title}</h1>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-sky-500 px-3 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-sky-600 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Bill</span>
            <span className="sm:hidden">Bill</span>
          </Link>
        </header>
        {signOutError && <p role="alert" className="mx-3 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 sm:mx-6 xl:mx-8">{signOutError}</p>}

        <main className="min-h-[calc(100vh-64px)] min-w-0 px-3 pb-24 pt-4 sm:px-6 sm:pt-6 xl:px-8 xl:pb-8 xl:pt-8">{children}</main>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <button type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 h-full w-full bg-slate-950/40" />
            <aside id="mobile-navigation-drawer" aria-label="Shop navigation" className="relative flex h-full w-[min(20rem,86vw)] flex-col bg-white shadow-2xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white"><Zap className="h-5 w-5" /></span>
                  <span><span className="block text-sm font-black tracking-tight">MAIN STREAM</span><span className="block text-[10px] font-bold tracking-[0.16em] text-sky-600">ELECTRONICS</span></span>
                </Link>
                <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
                  return (
                    <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`} />{label}
                    </Link>
                  );
                })}
              </nav>
              <div className="shrink-0 border-t border-slate-100 p-3">
                <button type="button" onClick={signOut} disabled={isSigningOut} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                  <LogOut className="h-4 w-4" />{isSigningOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </aside>
          </div>
        )}
        <nav aria-label="Mobile navigation" className="mobile-nav-safe fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 pt-2 xl:hidden">
          {primaryMobileItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-[9px] font-bold ${active ? 'text-sky-600' : 'text-slate-400'}`}>
                <Icon className="h-4 w-4" />
                <span className="max-w-[68px] truncate">{label === 'New Bill' ? 'Bill' : label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileMenuOpen}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-[9px] font-bold ${mobileMenuOpen ? 'text-sky-600' : 'text-slate-400'}`}>
            <Menu className="h-4 w-4" />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
