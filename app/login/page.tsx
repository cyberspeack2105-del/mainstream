import { LockKeyhole, Zap } from 'lucide-react';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-sky-100/60 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-600">Shop operations</p>
            <h1 className="text-lg font-black text-slate-900">MAIN STREAM ELECTRONICS</h1>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your shop account to open the dashboard.</p>
        </div>
        <LoginForm />
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <LockKeyhole className="h-3.5 w-3.5" />
          Secure shop access
        </p>
      </div>
    </main>
  );
}
