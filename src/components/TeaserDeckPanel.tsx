'use client';

/**
 * Investor Teaser — the 4-slide summary deck a sponsor sends once the LOI is accepted and the PSA is
 * being negotiated. Mirrors the real template: (1) Executive Summary metric tiles, (2) Why Invest —
 * five pillars, (3) Sponsor Team bios, (4) Important Dates. Numbers auto-fill from the Detailed-UW
 * base scenario; narrative (headline, pillars, bios, dates) is editable. On-screen preview for now;
 * an export comes later.
 */

import { useMemo } from 'react';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { MoneyInput } from '@/components/MoneyInput';
import {
  defaultDetailedInputs,
  defaultGPTeam,
  num,
  pct,
  runDetailedUW,
  usd,
  type GPTeamState,
  type MarketDeal,
} from '@/lib/sim';

interface TeaserState {
  headline: string;
  marketName: string;
  pillars: string[]; // 5
  bios: Record<string, string>; // memberId -> bullet text (one per line)
  minInvestment: number;
  dates: { loi: string; debtEquity: string; dd: string; closing: string };
}

const PILLAR_TITLES = ['Strong Market & Submarket', 'Job & Growth Drivers', 'Value-Add Opportunity', 'Experienced Sponsorship', 'Attractive Financing & Returns'];

function buildingClass(rating: number): string {
  return rating >= 4.25 ? 'A' : rating >= 3 ? 'B' : 'C';
}

export function TeaserDeckPanel({ deal }: { deal: MarketDeal }) {
  const [gp] = useDealLocal<GPTeamState>('gpteam', deal.id, defaultGPTeam('You (Sponsor)'));
  const [uwScenarios] = useDealLocal<{ id: string; name: string; inputs: unknown }[]>('uw-scenarios-v2', deal.id, []);
  const [c2c] = useDealLocal<{ startDate: string }>('c2c', deal.id, { startDate: new Date().toISOString().slice(0, 10) });

  const m = useMemo(() => {
    const base = (uwScenarios[0]?.inputs as ReturnType<typeof defaultDetailedInputs> | undefined) ?? defaultDetailedInputs(deal);
    try {
      const r = runDetailedUW(base);
      return {
        ok: uwScenarios.length > 0,
        price: base.purchasePrice,
        units: base.units,
        equity: r.equityRequired,
        irr: r.lpIRR,
        coc: r.lpAvgCashOnCash,
        em: r.lpEquityMultiple,
        hold: r.hold,
      };
    } catch {
      return { ok: false, price: deal.askPrice, units: deal.unitCount, equity: 0, irr: 0, coc: 0, em: 0, hold: 5 };
    }
  }, [uwScenarios, deal]);

  const addDays = (iso: string, d: number) => { const x = new Date(iso + 'T00:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const start = c2c.startDate;

  const [state, setState] = useDealLocal<TeaserState>('teaser', deal.id, {
    headline: `Well-positioned ${deal.city} asset in a high-growth market`,
    marketName: deal.msa || `${deal.city}, ${deal.state}`,
    pillars: ['', '', '', '', ''],
    bios: {},
    minInvestment: 50_000,
    dates: { loi: start, debtEquity: addDays(start, 20), dd: addDays(start, 30), closing: addDays(start, 60) },
  });

  const pricePerUnit = m.units > 0 ? m.price / m.units : 0;
  const pricePerSf = deal.rentableSqft > 0 ? m.price / deal.rentableSqft : 0;
  const setPillar = (i: number, v: string) => setState((s) => ({ ...s, pillars: s.pillars.map((p, j) => (j === i ? v : p)) }));
  const setBio = (id: string, v: string) => setState((s) => ({ ...s, bios: { ...s.bios, [id]: v } }));
  const setDate = (k: keyof TeaserState['dates'], v: string) => setState((s) => ({ ...s, dates: { ...s.dates, [k]: v } }));

  const tiles: { label: string; value: string }[] = [
    { label: 'Purchase Price', value: usd(m.price, { compact: true }) },
    { label: 'Price / Unit', value: usd(pricePerUnit) },
    { label: 'Price / SF', value: pricePerSf > 0 ? usd(pricePerSf) : '—' },
    { label: 'Equity Required', value: usd(m.equity, { compact: true }) },
    { label: 'Projected IRR', value: pct(m.irr, 1) },
    { label: 'Avg Cash-on-Cash', value: pct(m.coc, 1) },
    { label: 'Equity Multiple', value: `${m.em.toFixed(2)}x` },
    { label: 'Hold Period', value: `${m.hold} yrs` },
    { label: 'Min. Investment', value: usd(state.minInvestment, { compact: true }) },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">Investor Teaser</h2>
          <InfoTip
            title="Investor teaser deck"
            what="A concise 4-slide summary you send to prospective investors once your LOI is accepted and you're negotiating the PSA: the headline metrics, why the deal is attractive, who's running it, and the timeline. It's the short version — the full pitch deck and webinar come during the capital raise."
            app="The numbers auto-fill from your Detailed-UW base case; the narrative (headline, pillars, bios, dates) is yours to edit. This is an on-screen preview — export comes later."
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">A 4-slide investor summary, built from your underwriting and team.</p>
        {!m.ok && <p className="mt-1 text-xs text-amber-600">Tip: run your Detailed UW first so the metric tiles fill in with real numbers.</p>}
      </div>

      <div className="space-y-4 p-4">
        {/* Slide 1 — Executive Summary */}
        <Slide n={1} kicker="Executive Summary">
          <input value={state.headline} onChange={(e) => setState((s) => ({ ...s, headline: e.target.value }))} className="w-full rounded border border-transparent bg-transparent text-lg font-bold text-white placeholder-white/50 hover:border-white/30 focus:border-white/60 focus:outline-none" />
          <div className="mt-1 text-sm text-white/80">{deal.name} · {num(m.units)} units · Class {buildingClass(deal.propertyRating)} building / Class {buildingClass(deal.locationRating)} location</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
                <div className="text-base font-bold tabular-nums text-white">{t.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/70">{t.label}</div>
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-white/70">Min. investment $
            <MoneyInput value={state.minInvestment} onChange={(v) => setState((s) => ({ ...s, minInvestment: v }))} ariaLabel="Minimum investment" className="w-28 rounded border border-white/30 bg-white/10 px-2 py-0.5 text-right text-xs tabular-nums text-white focus:outline-none" />
          </label>
        </Slide>

        {/* Slide 2 — Why Invest */}
        <Slide n={2} kicker="Why Invest" light>
          <div className="text-lg font-bold text-slate-900">Why invest in {state.marketName}</div>
          <div className="mt-3 space-y-2">
            {PILLAR_TITLES.map((title, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{title}</div>
                  <textarea value={state.pillars[i]} onChange={(e) => setPillar(i, e.target.value)} placeholder="Add the specifics for this deal…" className="mt-0.5 h-10 w-full resize-none rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-slate-400 focus:outline-none" />
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* Slide 3 — Sponsor Team */}
        <Slide n={3} kicker="Sponsor Team" light>
          <div className="text-lg font-bold text-slate-900">Local team with experience</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gp.members.map((mem) => (
              <div key={mem.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">{mem.name.slice(0, 1).toUpperCase()}</span>
                  <div className="text-sm font-semibold text-slate-800">{mem.name}</div>
                </div>
                <textarea value={state.bios[mem.id] ?? ''} onChange={(e) => setBio(mem.id, e.target.value)} placeholder="Bullet points: experience, units sponsored, background, education…" className="mt-2 h-20 w-full resize-none rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-slate-400 focus:outline-none" />
              </div>
            ))}
          </div>
          {gp.members.length === 0 && <p className="text-xs text-slate-400">Add partners in GP Roles &amp; Splits to populate the team.</p>}
        </Slide>

        {/* Slide 4 — Important Dates */}
        <Slide n={4} kicker="Important Dates" light>
          <div className="text-lg font-bold text-slate-900">Exclusive to accredited &amp; sophisticated investors · first come, first served</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            {([
              ['loi', 'LOI & PSA', 'PSA in place after negotiation; legal paperwork in progress'],
              ['debtEquity', 'Secure Debt & Equity', 'Signed loan terms; equity commitments collected'],
              ['dd', 'Due Diligence', 'Physical inspections, lease & contract audit'],
              ['closing', 'Closing', 'Close and take over the asset'],
            ] as const).map(([key, title, desc], i) => (
              <div key={key} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-bold text-indigo-600">{i + 1}. {title}</div>
                <input type="date" value={state.dates[key]} onChange={(e) => setDate(key, e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-1 py-0.5 text-xs tabular-nums focus:outline-none" />
                <div className="mt-1 text-[11px] leading-snug text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </Slide>

        <p className="text-[10px] leading-relaxed text-slate-400">Illustrative summary only — not an offer to sell or a solicitation. Securities offerings are made only to accredited/sophisticated investors via formal offering documents. Verify all figures independently.</p>
      </div>
    </section>
  );
}

function Slide({ n, kicker, light, children }: { n: number; kicker: string; light?: boolean; children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl border ${light ? 'border-slate-200 bg-white' : 'border-indigo-900 bg-gradient-to-br from-indigo-700 to-indigo-900'} shadow-sm`}>
      <div className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${light ? 'bg-slate-50 text-slate-400' : 'bg-black/20 text-white/70'}`}>
        <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${light ? 'bg-slate-300 text-slate-700' : 'bg-white/30 text-white'}`}>{n}</span>
        {kicker}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
