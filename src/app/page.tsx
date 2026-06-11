'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { analyzeDeal, pct, usd, usd2, type MarketDeal } from '@/lib/sim';
import { readCookieSession } from '@/lib/supabase/token';

interface LookupResult {
  ok: boolean;
  matchedAddress?: string;
  city?: string;
  state?: string;
  medianHouseholdIncome: number | null;
  floodZone: string | null;
  sources: { label: string; value: string; source: string; real: boolean }[];
  note?: string;
}

export default function Landing() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  // 5 napkin inputs
  const [askPrice, setAskPrice] = useState(7_000_000);
  const [units, setUnits] = useState(62);
  const [inPlaceRent, setInPlaceRent] = useState(1000);
  const [marketRent, setMarketRent] = useState(1200);
  const [marketCap, setMarketCap] = useState(0.065);

  const [gameEnabled, setGameEnabled] = useState(true);

  useEffect(() => {
    setLoggedIn(!!readCookieSession());
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => setGameEnabled(j?.settings?.gameEnabled !== false))
      .catch(() => {});
  }, []);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch(`/api/lookup?address=${encodeURIComponent(address)}`);
      const j = (await r.json()) as LookupResult;
      if (!j.ok) setErr(j.note ?? 'Address not found.');
      setResult(j);
    } catch {
      setErr('Lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function enter(mode: 'game' | 'real') {
    try {
      localStorage.setItem('credeals-pending-mode', mode);
    } catch {
      /* ignore */
    }
    window.location.href = loggedIn ? '/app' : '/login';
  }

  const napkin = useMemo(() => {
    if (!result?.ok) return null;
    const expensePerUnit = Math.round(0.45 * (inPlaceRent * 12 + 600));
    const deal: MarketDeal = {
      id: 'landing',
      name: result.matchedAddress ?? address,
      address: result.matchedAddress ?? address,
      city: result.city ?? '',
      state: result.state ?? '',
      msa: '',
      assetClass: 'multifamily',
      vintage: 2000,
      unitCount: units,
      rentableSqft: units * 900,
      askPrice,
      avgInPlaceRent: inPlaceRent,
      avgMarketRent: marketRent,
      otherIncomePerUnitPerYr: 600,
      expensePerUnit,
      currentVacancy: 0.1,
      stabilizedVacancy: 0.07,
      walkInCapRate: marketCap,
      stabilizedCapRate: marketCap,
      propertyRating: 3,
      locationRating: 3,
      lookups: {
        medianHouseholdIncome: result.medianHouseholdIncome ?? 55_000,
        floodZone: result.floodZone ?? 'X',
        crimeIndex: 0,
        populationTrendPct: 0,
        rentGrowthYoYPct: 0,
      },
      broker: '',
      source: '',
      blurb: '',
    };
    return analyzeDeal(deal);
  }, [result, askPrice, units, inPlaceRent, marketRent, marketCap, address]);

  const uplift = napkin && napkin.current.valueAtCap > 0 ? napkin.proforma.valueAtCap / napkin.current.valueAtCap - 1 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-700 to-indigo-600 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-bold text-indigo-700">C</span>
          <span className="font-semibold">CRE Deals</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {gameEnabled && (
            <button onClick={() => enter('game')} className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-900 hover:bg-amber-300">
              🎮 Play Simulation
            </button>
          )}
          <button onClick={() => enter('real')} className="rounded-lg bg-emerald-400 px-3 py-1.5 font-semibold text-slate-900 hover:bg-emerald-300">
            🏢 Live Deal
          </button>
          <Link href="/login" className="rounded-lg border border-white/40 px-3 py-1.5 font-medium text-white hover:bg-white/10">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Underwrite any property in seconds.</h1>
        <p className="mx-auto mt-3 max-w-xl text-indigo-100">
          Drop in an address — get real location intelligence and an instant napkin underwrite. Like what you see?
          Sign up to underwrite in detail, make an offer, and learn the whole deal lifecycle.
        </p>

        <form onSubmit={analyze} className="mx-auto mt-6 flex max-w-xl gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter a property address…  e.g. 123 Main St, City, ST"
              className="w-full rounded-lg border-2 border-amber-300 bg-white py-3 pl-9 pr-3 text-slate-900 shadow-lg shadow-indigo-900/30 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300/40"
            />
          </div>
          <button disabled={loading} className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>
        {err && <p className="mt-3 text-sm text-amber-200">{err}</p>}

        {result?.ok && (
          <div className="mx-auto mt-8 max-w-2xl space-y-4 text-left">
            <section className="rounded-xl bg-white p-4 text-slate-900 shadow-lg">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">✨ AI Enhanced Data</div>
              <div className="mb-3 text-sm font-semibold">{result.matchedAddress}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {result.sources.map((s) => (
                  <div key={s.label} className="rounded-md border border-slate-200 px-2 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</div>
                    <div className={`text-sm font-semibold ${s.real ? 'text-slate-800' : 'text-amber-600'}`}>{s.value}</div>
                    <div className="mt-0.5 text-[9px] text-slate-400">src: {s.source}{s.real ? '' : ' ·est'}</div>
                  </div>
                ))}
              </div>
              {result.note && <p className="mt-2 text-[11px] text-slate-500">{result.note}</p>}
            </section>

            <section className="rounded-xl bg-white p-4 text-slate-900 shadow-lg">
              <div className="mb-2 text-sm font-semibold">Instant napkin</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Num label="Ask price" value={askPrice} step={100_000} onChange={setAskPrice} money />
                <Num label="Units" value={units} onChange={setUnits} />
                <Num label="In-place rent /mo" value={inPlaceRent} onChange={setInPlaceRent} money />
                <Num label="Market rent /mo" value={marketRent} onChange={setMarketRent} money />
                <Pct label="Market cap rate" value={marketCap} onChange={setMarketCap} />
              </div>
              {napkin && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Stat label="Current value" value={usd(napkin.current.valueAtCap, { compact: true })} />
                  <Stat label="Proforma value" value={usd(napkin.proforma.valueAtCap, { compact: true })} />
                  <Stat label="Value uplift" value={`${uplift >= 0 ? '+' : ''}${pct(uplift)}`} tone={uplift >= 0 ? 'good' : 'bad'} />
                  <Stat label="Proforma vs offer" value={`${napkin.proforma.pctVsAsk >= 0 ? '+' : ''}${pct(napkin.proforma.pctVsAsk)}`} tone={napkin.proforma.pctVsAsk >= 0 ? 'good' : 'bad'} />
                  <Stat label="DSCR" value={napkin.financing.dscr.toFixed(2)} tone={napkin.financing.financeable ? 'good' : 'bad'} />
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Current value = today&apos;s rents; proforma = market rents — both at your market cap. Affordability uses the
                real median income for this census tract{napkin ? ` (avg household affords ${usd2(napkin.affordableRent)}/mo)` : ''}.
                The full model (T-12 + rent roll, proforma, financing, returns) is in the workspace.
              </p>
            </section>

            <div className="rounded-xl bg-white/10 p-4 text-center">
              <p className="text-sm">Want to save this deal, underwrite it in detail, or make an offer?</p>
              <Link href="/login" className="mt-2 inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50">
                Sign up free to continue →
              </Link>
            </div>
          </div>
        )}

        <p className="mt-10 text-xs text-indigo-200">
          Real data: U.S. Census Geocoder + ACS · FEMA flood zones. Part game, part training — learn the full CRE deal lifecycle.
        </p>
        <p className="mt-2 text-[10px] text-indigo-300/80">
          This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.
        </p>
      </main>
    </div>
  );
}

function Num({ label, value, onChange, step = 1, money }: { label: string; value: number; onChange: (v: number) => void; step?: number; money?: boolean }) {
  return (
    <label className="block text-left">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="relative">
        {money && <span className="pointer-events-none absolute left-2 top-2 text-xs text-slate-400">$</span>}
        <input type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full rounded-md border border-slate-300 py-1.5 text-sm tabular-nums focus:border-slate-900 focus:outline-none ${money ? 'pl-5 pr-2' : 'px-2'}`} />
      </div>
    </label>
  );
}

function Pct({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-left">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="relative">
        <input type="number" value={+(value * 100).toFixed(2)} step={0.25} onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full rounded-md border border-slate-300 py-1.5 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
        <span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-400">%</span>
      </div>
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="rounded-md border border-slate-200 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
