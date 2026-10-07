'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import ShopShell from '@/components/shop/ShopShell';

type Message = { role: 'user' | 'assistant'; content: string; reasoning_details?: unknown };

const suggestions = [
  'Which products are low in stock?',
  'Summarize sales for the last 30 days.',
  'What is the total customer due?',
  'Recommend products to reorder first.',
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  async function sendMessage(event?: FormEvent<HTMLFormElement>, suggestedText?: string) {
    event?.preventDefault();
    const message = (suggestedText ?? draft).trim();
    if (!message || busy) return;

    const history = messages.slice(-12);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to get an AI response.');
      setMessages((current) => [...current, {
        role: 'assistant',
        content: result.answer as string,
        ...(result.reasoning_details !== undefined ? { reasoning_details: result.reasoning_details } : {}),
      }]);
      window.setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 0);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to get an AI response.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell title="AI Assistant">
      <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[280px] min-w-0 max-w-5xl flex-col gap-3 pb-0 sm:gap-4 xl:h-[calc(100vh-8rem)]">
        <section className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900">Shop AI Assistant</h2>
            <p className="mt-1 text-xs text-slate-500">NVIDIA Nemotron 3 Ultra · Live product, stock, sales and due insights</p>
          </div>
          <span className="ml-auto hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 sm:inline-flex"><Sparkles className="h-3.5 w-3.5" /> Business aware</span>
        </section>

        <section ref={scrollRef} aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:p-6">
          {!messages.length && (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Sparkles className="h-6 w-6" /></span>
                <h3 className="mt-4 text-lg font-extrabold text-slate-900">How can I help your shop?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">Ask about live products, stock levels, recent sales, customer dues, or reorder priorities.</p>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" disabled={busy} onClick={() => void sendMessage(undefined, suggestion)} className="rounded-lg border border-slate-200 p-3 text-left text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50">{suggestion}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Bot className="h-4 w-4" /></span>}
              <div className={`max-w-[85%] min-w-0 break-words whitespace-pre-wrap rounded-xl px-3 py-3 text-sm leading-6 sm:px-4 ${message.role === 'user' ? 'bg-sky-500 text-white' : 'border border-slate-100 bg-slate-50 text-slate-800'}`}>{message.content}</div>
              {message.role === 'user' && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><User className="h-4 w-4" /></span>}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" /> Checking live shop data and preparing an answer…</div>}
        </section>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <label className="sr-only" htmlFor="ai-message">Ask the shop assistant</label>
          <textarea id="ai-message" rows={1} maxLength={3000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }} placeholder="Ask about your products, sales, stock, or dues…" className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border-0 px-3 py-3 text-sm outline-none focus:ring-0" />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </form>
        <p className="text-center text-[10px] text-slate-400">Prompts and limited product/inventory plus aggregate sales/due data are processed by OpenRouter. Customer personal details are not sent. AI can make mistakes; verify important decisions in the records.</p>
      </div>
    </ShopShell>
  );
}
