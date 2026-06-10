'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/app` : undefined;

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/app';
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        // Supabase returns an "obscured" user with no identities when the email is already
        // registered — no email is sent in that case, so tell the user instead of "check email".
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setMsg({ kind: 'err', text: 'An account with this email already exists — sign in instead (or use the magic link below).' });
          setMode('signin');
        } else {
          setMsg({ kind: 'ok', text: 'Check your email to confirm your account, then sign in.' });
        }
      }
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email) return setMsg({ kind: 'err', text: 'Enter your email first.' });
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: 'Magic link sent — check your email.' });
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">C</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">CRE Deals</div>
            <div className="text-xs text-slate-500">{mode === 'signin' ? 'Sign in to your workspace' : 'Create your account'}</div>
          </div>
        </div>

        {!configured && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase isn&apos;t connected yet — sign-in activates once the project keys are added to
            <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code>. (The app still works without login for now.)
          </div>
        )}

        <fieldset disabled={!configured || busy} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              placeholder="you@company.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          <button onClick={withPassword} className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button type="button" onClick={magicLink} className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            ✉️ Email me a magic link
          </button>
          <button type="button" onClick={google} className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Continue with Google
          </button>
        </fieldset>

        {msg && (
          <p className={`mt-3 text-xs ${msg.kind === 'err' ? 'text-red-600' : 'text-emerald-600'}`}>{msg.text}</p>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="font-medium text-slate-900 underline">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/" className="text-slate-400 hover:text-slate-700">← Back to the app</Link>
        </p>
      </div>
    </main>
  );
}
