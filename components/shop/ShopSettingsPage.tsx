'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ShopShell from '@/components/shop/ShopShell';

type ShopProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  upiId: string;
};

const emptyProfile: ShopProfile = {
  name: 'MAIN STREAM ELECTRONICS',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  upiId: '',
};

export default function ShopSettingsPage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/settings', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load shop settings.');
        if (active) setProfile({ ...emptyProfile, ...result });
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load shop settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save shop settings.');
      setProfile({ ...emptyProfile, ...result });
      setMessage('Shop profile saved. New invoices and UPI QR codes will use these details.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save shop settings.');
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<{ key: keyof ShopProfile; label: string; required?: boolean }> = [
    { key: 'name', label: 'Shop name', required: true },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'upiId', label: 'UPI ID (for customer QR payments)' },
  ];

  return (
    <ShopShell title="Settings">
      <div className="mx-auto max-w-3xl space-y-5 pb-20 lg:pb-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">Shop configuration</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Shop profile & payments</h2>
          <p className="mt-1 text-sm text-slate-500">These live details are printed on customer invoices and used to create UPI QR codes.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          {fields.map(({ key, label, required }) => (
            <label key={key} className="block text-xs font-bold text-slate-600">
              {label}{required ? ' *' : ''}
              <input
                required={required}
                maxLength={500}
                value={profile[key]}
                onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                disabled={loading}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"
              />
            </label>
          ))}
          <button type="submit" disabled={loading || saving} className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-extrabold text-white hover:bg-sky-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save shop profile'}
          </button>
        </form>
      </div>
    </ShopShell>
  );
}
