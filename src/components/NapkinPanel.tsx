'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { MoneyInput } from '@/components/MoneyInput';
import { StageEncounters } from '@/components/StageEncounters';
import { scoreUW, getCoachMessage, buildNapkinScenarios } from '@/lib/sim';
import {
  analyzeDeal,
  assetConfig,
  dealCounterparties,
  defaultOverrides,
  matchBuyBox,
  num,
  pct,
  usd,
  usd2,
  type DealFile,
  type DealFileKind,
  type MarketDeal,
  type NapkinOverrides,
  type NapkinScenarioOutput,
  type Persona,
  type Sensitivity2D,
} from '@/lib/sim';

const SECTIONS = [
  ['overview', 'Overview'],
  ['lookups', 'Lookups'],
  ['assumptions', 'Assumptions'],
  ['financing', 'Financing'],
  ['valuation', 'Valuation'],
  ['sensitivity', 'Sensitivity'],
  ['files', 'Files'],
  ['decision', 'Decision'],
] as const;

export function NapkinPanel({
  deal,
  onOpenConversation,
}: {
  deal: MarketDeal;
  onOpenConversation: () => void;
}) {
  const { buyBox, overridesOf, setOverride, resetOverrides, statusOf, setStatus, mode, isAdmin, commentsOf, filesOf, addFiles, coachingMode, updateDealDNA, addCoachMessage, sessionSeed, game, difficulty } =
    useApp();
  const napkinScenarios = useMemo(
    () => buildNapkinScenarios({ market: game.market, difficulty: difficulty ?? 'standard', seller: dealCounterparties(deal.id, sessionSeed?.value ?? 0).seller }),
    [game.market, difficulty, deal.id, sessionSeed?.value],
  );
  const ov = overridesOf(deal.id);
  const eff = { ...defaultOverrides(deal), ...ov };
  const r = analyzeDeal(deal, ov);

  // The napkin defaults to a true gut-check (just the few core inputs). "Full analysis" reveals the
  // current-financials column, financing, valuation table, and sensitivity grid (owner item 6).
  const [view, setView] = useState<'simple' | 'full'>('simple');
  // Light capex/unit estimate so the napkin compares the stabilized value to an all-in basis, not
  // just the offer. Persisted per deal; also feeds the UW-aggressiveness signal.
  const [capexPerUnit, setCapexPerUnit] = useDealLocal<number>('napkin-capex', deal.id, 7500);

  // UW aggressiveness (game mode): how far the player's assumptions push vs. asset-class consensus
  const uw = useMemo(
    () => scoreUW({
      rentVsMarket: eff.avgInPlaceRent > 0 ? eff.avgMarketRent / eff.avgInPlaceRent : 1,
      expenseRatio: eff.proformaExpenseRatio,
      exitCapRate: eff.stabilizedCapRate,
      capexPerUnit,
      vacancyStabilized: eff.stabilizedVacancy,
    }, deal.assetClass),
    [eff.avgInPlaceRent, eff.avgMarketRent, eff.proformaExpenseRatio, eff.stabilizedCapRate, eff.stabilizedVacancy, deal.assetClass, capexPerUnit],
  );
  useEffect(() => {
    if (mode === 'game') updateDealDNA(deal.id, { uwScore: uw.score });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uw.score, deal.id, mode]);

  // proactive coach nudge when assumptions turn aggressive (full coaching only), once per deal
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (mode === 'game' && coachingMode === 'full' && uw.score >= 3 && !nudgedRef.current) {
      nudgedRef.current = true;
      const t = getCoachMessage('napkin-aggressive');
      if (t) addCoachMessage({ from: 'coach', text: t, dealId: deal.id, phase: 'napkin', trigger: 'napkin-aggressive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uw.score, mode, coachingMode]);
  const match = matchBuyBox(deal, buyBox);
  const status = statusOf(deal.id);
  const edited = Object.keys(ov).length > 0;
  const cfg = assetConfig(deal.assetClass);
  const set = (patch: Partial<NapkinOverrides>) => setOverride(deal.id, patch);
  const go = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Sticky in-deal section nav (clickable) */}
      <div className="sticky top-[68px] z-20 flex flex-wrap items-center gap-1 rounded-t-xl border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur">
        {/* Simple ⇄ Full toggle — the napkin is a gut-check by default */}
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs font-medium">
          <button onClick={() => setView('simple')} className={`rounded-md px-2.5 py-1 ${view === 'simple' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Simple</button>
          <button onClick={() => setView('full')} className={`rounded-md px-2.5 py-1 ${view === 'full' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Full analysis</button>
        </div>
        {view === 'full' && SECTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => go(id)}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            {label}
          </button>
        ))}
        <button
          onClick={onOpenConversation}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100"
        >
          <span className="text-base leading-none">💬</span> Conversation
          {commentsOf(deal.id).length > 0 && <span className="rounded-full bg-sky-600 px-1.5 text-xs font-semibold text-white tabular-nums">{commentsOf(deal.id).length}</span>}
        </button>
      </div>

      {/* Live early-stage encounters (game mode) — broker calls, OM scrutiny … so sourcing isn't empty */}
      {mode === 'game' && difficulty && napkinScenarios.length > 0 && (
        <div className="px-4 pt-4">
          <StageEncounters deal={deal} phase="napkin" builtins={napkinScenarios} icon="📞" />
        </div>
      )}

      {/* Overview */}
      <div id="sec-overview" className="scroll-mt-36 border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{deal.name}</h2>
            <div className="text-xs text-slate-500">
              {deal.address}, {deal.city}, {deal.state} · {deal.msa}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">{usd(deal.askPrice)}</div>
            <div className="text-xs text-slate-500">Ask · {usd(deal.askPrice / deal.unitCount)}/{cfg.unitNoun}</div>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">{deal.blurb}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <Chip>{cfg.label}</Chip>
          <Chip>Built {deal.vintage}</Chip>
          <Chip>{deal.unitCount} {cfg.unitNounPlural}</Chip>
          <Chip>{num(deal.rentableSqft)} sf</Chip>
          <Chip>Prop ★{deal.propertyRating}</Chip>
          <Chip>Loc ★{deal.locationRating}</Chip>
          <Chip>{deal.broker}</Chip>
        </div>
        {!match.matches && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            Outside buy box: {match.reasons.join(' · ')}
          </div>
        )}
        {mode === 'game' && isAdmin && <Counterparties dealId={deal.id} salt={sessionSeed?.value ?? 0} />}
      </div>

      {/* AI Enhanced Data */}
      <div id="sec-lookups" className="scroll-mt-36 border-b border-slate-100 bg-slate-50/60 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>✨ AI Enhanced Data</span>
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">auto-pulled from address</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Look label="Median income" value={usd(deal.lookups.medianHouseholdIncome, { compact: true })} source="U.S. Census ACS" />
          <Look label="Flood zone" value={deal.lookups.floodZone.split(' ')[1] ?? deal.lookups.floodZone} title={deal.lookups.floodZone} warn={deal.lookups.floodZone.includes('AE')} source="FEMA NFHL" />
          <Look label="Crime index" value={`${deal.lookups.crimeIndex}/100`} warn={deal.lookups.crimeIndex >= 60} source="FBI UCR + local" />
          <Look label="Population" value={`${deal.lookups.populationTrendPct >= 0 ? '↑' : '↓'} ${Math.abs(deal.lookups.populationTrendPct)}%/yr`} warn={deal.lookups.populationTrendPct < 0} source="Census + Esri" />
          <Look label="Rent growth" value={`${deal.lookups.rentGrowthYoYPct >= 0 ? '+' : ''}${deal.lookups.rentGrowthYoYPct}%`} source="CoStar / Radix" />
        </div>
      </div>

      {/* Assumptions */}
      <div id="sec-assumptions" className="scroll-mt-36 border-b border-slate-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Napkin assumptions</h3>
          {edited && (
            <button onClick={() => resetOverrides(deal.id)} className="text-xs text-slate-500 underline hover:text-slate-900">
              Reset to listing
            </button>
          )}
        </div>
        {view === 'simple' ? (
          /* The napkin: a handful of inputs and an instant read on value vs. your all-in basis. */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">Your plan <InfoTip title="Napkin underwriting" what="A back-of-the-envelope test: at your target market rent, expense ratio, and exit cap, what is the stabilized property worth — and is that above what you'll have in it (offer + capex)? If yes, the deal pencils; if not, walk or sharpen your pencil." app="This is the quick gut-check. Switch to Full analysis for financing, the valuation table, and the sensitivity grid." /></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Field label="Offer price" info="m.offerPrice" value={eff.offerPrice} step={100_000} onChange={(v) => set({ offerPrice: v })} money />
                <Field label={`Capex /${cfg.unitNoun}`} value={capexPerUnit} step={500} onChange={setCapexPerUnit} money info="m.capex" />
                <Field label="Market rent /mo" info="m.marketRent" value={eff.avgMarketRent} onChange={(v) => set({ avgMarketRent: v })} money />
                <PctField label="Proforma exp ratio" info="m.expenseRatio" value={eff.proformaExpenseRatio} onChange={(v) => set({ proformaExpenseRatio: v })} />
                <PctField label="Valuation cap" info="m.stabilizedCap" value={eff.stabilizedCapRate} onChange={(v) => set({ stabilizedCapRate: v })} />
                <PctField label="Stabilized vacancy" info="m.vacancy" value={eff.stabilizedVacancy} onChange={(v) => set({ stabilizedVacancy: v })} />
              </div>
            </div>
            <SimpleResult r={r} offer={eff.offerPrice} capex={capexPerUnit * deal.unitCount} cap={eff.stabilizedCapRate} affordableRent={r.affordableRent} marketRent={eff.avgMarketRent} />
          </div>
        ) : (
          <>
            <Field label="Offer price" info="m.offerPrice" value={eff.offerPrice} step={100_000} onChange={(v) => set({ offerPrice: v })} money wide />
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">Current (from financials)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="In-place rent /mo" info="m.inPlaceRent" value={eff.avgInPlaceRent} onChange={(v) => set({ avgInPlaceRent: v })} money />
                  <Field label={`Exp /${cfg.unitNoun}/yr`} info="m.expensePerUnit" value={eff.currentExpensePerUnit} step={100} onChange={(v) => set({ currentExpensePerUnit: v })} money />
                  <PctField label="Walk-in cap" info="m.walkInCap" value={eff.walkInCapRate} onChange={(v) => set({ walkInCapRate: v })} />
                  <PctField label="Vacancy" info="m.vacancy" value={eff.currentVacancy} onChange={(v) => set({ currentVacancy: v })} />
                </div>
                <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                  → Implied current expense ratio: <b>{pct(r.current.expenseRatio)}</b>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="mb-2 text-xs font-semibold text-emerald-700">Proforma (your plan)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Market rent /mo" info="m.marketRent" value={eff.avgMarketRent} onChange={(v) => set({ avgMarketRent: v })} money />
                  <PctField label="Stabilized vacancy" info="m.vacancy" value={eff.stabilizedVacancy} onChange={(v) => set({ stabilizedVacancy: v })} />
                  <PctField label="Proforma exp ratio" info="m.expenseRatio" value={eff.proformaExpenseRatio} onChange={(v) => set({ proformaExpenseRatio: v })} />
                  <PctField label="Valuation cap" info="m.stabilizedCap" value={eff.stabilizedCapRate} onChange={(v) => set({ stabilizedCapRate: v })} />
                </div>
                <div className="mt-2 rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                  → Proforma value: <b>{usd(r.proforma.valueAtCap, { compact: true })}</b> at {pct(eff.stabilizedCapRate)} cap
                </div>
              </div>
            </div>
          </>
        )}

        {/* UW aggressiveness band (game mode; hidden for the silent coaching profile) */}
        {mode === 'game' && coachingMode !== 'silent' && <UWBand uw={uw} />}
      </div>

      {view === 'full' && (<>
      {/* Financing */}
      <div id="sec-financing" className="scroll-mt-36 border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Financing</h3>
        <div className="mb-3 flex rounded-lg border border-slate-300 p-0.5 text-xs font-medium">
          <button
            onClick={() => set({ financingType: 'new' })}
            className={`flex-1 rounded-md px-3 py-1.5 ${eff.financingType === 'new' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            New loan (size to LTV)
          </button>
          <button
            onClick={() => set({ financingType: 'assumption' })}
            className={`flex-1 rounded-md px-3 py-1.5 ${eff.financingType === 'assumption' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Loan assumption (specify loan)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {eff.financingType === 'new' ? (
            <PctField label="LTV" info="f.ltv" value={eff.ltv} onChange={(v) => set({ ltv: v })} />
          ) : (
            <Field label="Assumed loan $" info="f.assumption" value={eff.assumedLoanAmount} step={100_000} onChange={(v) => set({ assumedLoanAmount: v })} money />
          )}
          <PctField label="Interest rate" info="f.interestRate" value={eff.interestRate} onChange={(v) => set({ interestRate: v })} />
          <Field label="Amort (months)" info="f.amort" value={eff.amortMonths} step={12} onChange={(v) => set({ amortMonths: v })} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Loan amount" value={usd(r.financing.loanAmount, { compact: true })} />
          <Stat
            label={eff.financingType === 'assumption' ? 'Down payment (derived)' : 'Down payment'}
            value={usd(r.financing.downPayment, { compact: true })}
          />
          <Stat label="Down payment %" value={pct(r.financing.downPaymentPct)} />
          <Stat label="Effective LTV" value={pct(r.financing.ltv)} />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="flex items-center gap-1 text-xs text-slate-500">DSCR (stabilized): <InfoTip k="m.dscr" /></span>
          <span className={`text-lg font-bold ${r.financing.financeable ? 'text-emerald-600' : 'text-red-600'}`}>
            {r.financing.dscr.toFixed(2)}
          </span>
          <span className="text-xs text-slate-500">
            need ≥ 1.25 · {r.financing.financeable ? '✓ financeable' : '✕ short — more equity / lower price'}
          </span>
        </div>
        {eff.financingType === 'assumption' && (
          <p className="mt-1 text-[11px] text-slate-500">
            Assumption: down payment = offer − loan, and the down-payment % is computed (not input). Matches the Synthesis dashboard change you asked for.
          </p>
        )}
      </div>

      {/* Valuation */}
      <div id="sec-valuation" className="scroll-mt-36 border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Valuation</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="text-left font-medium">Metric</th>
              <th className="text-right font-medium">Current</th>
              <th className="text-right font-medium">Proforma</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <RowR label="Economic income" cur={usd(r.current.economicIncome)} pro={usd(r.proforma.economicIncome)} />
            <RowR label="Operating expenses" cur={usd(r.current.expenseTotal)} pro={usd(r.proforma.expenseTotal)} />
            <RowR label="Expense ratio" cur={pct(r.current.expenseRatio)} pro={pct(r.proforma.expenseRatio)} muted />
            <RowR label="NOI" cur={usd(r.current.noi)} pro={usd(r.proforma.noi)} bold />
            <RowR label="Value at cap" cur={usd(r.current.valueAtCap)} pro={usd(r.proforma.valueAtCap)} bold />
            <RowR label={`Value / ${cfg.unitNoun}`} cur={usd(r.current.valuePerUnit)} pro={usd(r.proforma.valuePerUnit)} muted />
            <RowR label="Value vs offer" cur={<Verdict s={r.current} />} pro={<Verdict s={r.proforma} />} />
          </tbody>
        </table>
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">Affordability <InfoTip k="m.affordability" /></div>
          <div className="mt-1 text-sm text-slate-700">
            Avg local household can afford <b>{usd2(r.affordableRent)}</b>/mo · your proforma rent {usd2(eff.avgMarketRent)} ·{' '}
            <span className={eff.avgMarketRent <= r.affordableRent ? 'text-emerald-600' : 'text-amber-600'}>
              {eff.avgMarketRent <= r.affordableRent ? 'within reach' : 'above affordability'}
            </span>
          </div>
        </div>
      </div>

      {/* Sensitivity */}
      <div id="sec-sensitivity" className="scroll-mt-36 border-b border-slate-100 p-4">
        <h3 className="mb-1 text-sm font-semibold">Value sensitivity — exit cap × expense ratio</h3>
        <p className="mb-2 text-[11px] text-slate-500">
          ⬛ = your assumptions; the dotted row marks today&apos;s in-place expense ratio.
        </p>
        <SensitivityGrid s={r.sensitivity} offer={eff.offerPrice} />
      </div>

      {/* Files */}
      <FilesSection dealId={deal.id} files={filesOf(deal.id)} addFiles={addFiles} />
      </>)}

      {/* Decision */}
      <div id="sec-decision" className="scroll-mt-36 p-4">
        <h3 className="mb-2 text-sm font-semibold">Decision</h3>
        <div className="flex flex-wrap gap-2">
          <DecisionBtn active={false} tone="emerald" onClick={() => setStatus(deal.id, 'detailed')}>
            Pass napkin → Detailed UW{mode === 'game' ? ' (−$7,500 costs)' : ''}
          </DecisionBtn>
          <DecisionBtn active={status === 'napkin'} tone="sky" onClick={() => setStatus(deal.id, 'napkin')}>
            Keep underwriting
          </DecisionBtn>
          <DecisionBtn active={status === 'archived'} tone="slate" onClick={() => setStatus(deal.id, 'archived')}>
            Archive
          </DecisionBtn>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Passing napkin advances the deal to Detailed UW (T-12 + rent roll), then LOI → Contract-to-Close → Asset Management.
        </p>
      </div>
    </section>
  );
}

function FilesSection({
  dealId,
  files,
  addFiles,
}: {
  dealId: string;
  files: DealFile[];
  addFiles: ReturnType<typeof useApp>['addFiles'];
}) {
  const [kind, setKind] = useState<DealFileKind>('OM');
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    addFiles(
      dealId,
      picked.map((f) => ({ id: `${dealId}-${f.name}-${Date.now()}`, name: f.name, kind, sizeBytes: f.size, ts: Date.now() })),
    );
    e.target.value = '';
  }
  const badge: Record<DealFileKind, string> = {
    T12: 'bg-indigo-100 text-indigo-700',
    RentRoll: 'bg-violet-100 text-violet-700',
    OM: 'bg-amber-100 text-amber-700',
    CoStar: 'bg-sky-100 text-sky-700',
    PSA: 'bg-emerald-100 text-emerald-700',
    LOI: 'bg-rose-100 text-rose-700',
    Other: 'bg-slate-100 text-slate-600',
  };
  return (
    <div id="sec-files" className="scroll-mt-36 border-b border-slate-100 p-4">
      <h3 className="mb-1 text-sm font-semibold">Deal files</h3>
      <p className="mb-2 text-[11px] text-slate-500">
        Broker OM, CoStar report, T-12, rent roll — stored with the deal (replaces the Google-Drive-folder-per-deal pattern).
      </p>
      <ul className="mb-2 space-y-1">
        {files.length === 0 && <li className="text-xs text-slate-400">No files yet.</li>}
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge[f.kind]}`}>{f.kind}</span>
            <span className="truncate text-slate-700">{f.name}</span>
            <span className="ml-auto text-[11px] text-slate-400">{Math.max(1, Math.round(f.sizeBytes / 1024))} KB</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DealFileKind)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none"
        >
          {(['OM', 'CoStar', 'T12', 'RentRoll', 'Other'] as DealFileKind[]).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
          + Upload file
          <input type="file" multiple className="hidden" onChange={onPick} />
        </label>
      </div>
    </div>
  );
}

function SensitivityGrid({ s, offer }: { s: Sensitivity2D; offer: number }) {
  const cellTone = (v: number) => {
    const ratio = offer > 0 ? v / offer : 0;
    if (ratio >= 1.1) return 'bg-emerald-100 text-emerald-900';
    if (ratio >= 1) return 'bg-emerald-50 text-slate-700';
    if (ratio >= 0.9) return 'bg-amber-50 text-amber-900';
    return 'bg-red-50 text-red-900';
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-slate-500">Exp ratio ↓ / Cap →</th>
            {s.capRates.map((c, ci) => (
              <th key={ci} className={`px-2 py-1 text-right font-medium ${ci === s.centerCol ? 'text-slate-900 underline' : 'text-slate-500'}`}>
                {pct(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.expenseRatios.map((er, ri) => (
            <tr key={ri} className={ri === s.currentRow ? 'outline-dotted outline-1 outline-slate-400' : ''}>
              <td className={`px-2 py-1 font-medium ${ri === s.centerRow ? 'text-slate-900 underline' : 'text-slate-600'}`}>
                {pct(er)}
                {ri === s.currentRow && <span className="ml-1 text-[9px] text-slate-400">in-place</span>}
              </td>
              {s.values[ri].map((v, ci) => {
                const isCenter = ri === s.centerRow && ci === s.centerCol;
                return (
                  <td key={ci} className={`px-2 py-1 text-right tabular-nums ${cellTone(v)} ${isCenter ? 'ring-2 ring-inset ring-slate-900 font-bold' : ''}`}>
                    {usd(v, { compact: true })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-400">Green ≈ value at/above your offer ({usd(offer, { compact: true })}); red below.</p>
    </div>
  );
}

// --- small pieces ---

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5">{children}</span>;
}

function UWBand({ uw }: { uw: ReturnType<typeof scoreUW> }) {
  const pos = Math.max(0, Math.min(100, ((uw.score - 1) / 3) * 100)); // score 1–4 → 0–100%
  const tone = uw.score >= 3.5 ? 'text-red-600' : uw.score >= 2.8 ? 'text-amber-600' : uw.score >= 2.0 ? 'text-slate-700' : 'text-emerald-600';
  return (
    <div className="mt-3 rounded-lg border-2 border-slate-200 bg-slate-50 p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-700">Underwriting aggressiveness</span>
        <InfoTip title="UW aggressiveness" what="How far your assumptions (rent vs. in-place, expense ratio, exit cap, vacancy) push beyond market consensus for this asset class. Aggressive assumptions inflate projected returns — and make the business plan harder to actually hit." app="Conservative wins LP trust and beats projections; aggressive wins competitive deals but raises the odds of missing in Asset Management." />
        <span className={`ml-auto text-xs font-bold ${tone}`}>{uw.label} · {uw.score.toFixed(1)}</span>
      </div>
      <div className="relative mt-1.5 h-2 w-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-red-400">
        <div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-slate-900" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-slate-400">
        <span>Conservative</span><span>Market</span><span>Aggressive</span>
      </div>
    </div>
  );
}

function SimpleResult({ r, offer, capex, cap, affordableRent, marketRent }: { r: ReturnType<typeof analyzeDeal>; offer: number; capex: number; cap: number; affordableRent: number; marketRent: number }) {
  const value = r.proforma.valueAtCap;
  const allIn = offer + capex;
  const delta = value - allIn;
  const deltaPct = allIn > 0 ? delta / allIn : 0;
  const pencils = delta >= 0;
  return (
    <div className={`rounded-lg border p-3 ${pencils ? 'border-emerald-300 bg-emerald-50/60' : 'border-amber-300 bg-amber-50/60'}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">Does it pencil? <InfoTip k="m.affordability" /></div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${pencils ? 'text-emerald-700' : 'text-amber-700'}`}>
        {pencils ? '+' : ''}{usd(delta, { compact: true })}
        <span className="ml-1 text-sm font-medium">({pencils ? '+' : ''}{pct(deltaPct)})</span>
      </div>
      <div className="text-[11px] text-slate-500">stabilized value vs. your all-in basis</div>
      <div className="mt-2 space-y-1 text-sm tabular-nums">
        <Line label={`Proforma NOI`} value={usd(r.proforma.noi)} />
        <Line label={`Stabilized value @ ${pct(cap)} cap`} value={usd(value, { compact: true })} bold />
        <Line label="Offer price" value={usd(offer, { compact: true })} />
        <Line label="+ Capex" value={usd(capex, { compact: true })} />
        <Line label="= All-in basis" value={usd(allIn, { compact: true })} bold />
      </div>
      <div className="mt-2 rounded bg-white/70 px-2 py-1 text-[11px] text-slate-600">
        Local household can afford <b>{usd2(affordableRent)}</b>/mo · your rent {usd2(marketRent)} ·{' '}
        <span className={marketRent <= affordableRent ? 'text-emerald-600' : 'text-amber-600'}>{marketRent <= affordableRent ? 'within reach' : 'above affordability'}</span>
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-slate-500 ${bold ? 'font-semibold text-slate-700' : ''}`}>{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-700'}>{value}</span>
    </div>
  );
}

function Counterparties({ dealId, salt }: { dealId: string; salt: number }) {
  const { broker, seller } = dealCounterparties(dealId, salt);
  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
        🎭 Counterparties <span className="rounded bg-violet-100 px-1 text-[9px]">game</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PersonaCard role="Broker" p={broker} />
        <PersonaCard role="Seller" p={seller} />
      </div>
    </div>
  );
}

function PersonaCard({ role, p }: { role: string; p: Persona }) {
  return (
    <div className="rounded-md border border-violet-100 bg-white p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{role}</div>
      <div className="text-sm font-semibold text-slate-800">{p.name}</div>
      <div className="text-[11px] text-slate-500">{p.blurb}</div>
      <div className="mt-1 text-[11px] text-violet-700">💡 {p.tells[0]}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Look({ label, value, warn, title, source }: { label: string; value: string; warn?: boolean; title?: string; source?: string }) {
  return (
    <div title={title} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${warn ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
      {source && <div className="mt-0.5 text-[9px] text-slate-400">src: {source}</div>}
    </div>
  );
}

function RowR({ label, cur, pro, bold, muted }: { label: string; cur: React.ReactNode; pro: React.ReactNode; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={`border-t border-slate-50 ${muted ? 'text-slate-500' : ''}`}>
      <td className={`py-1 text-left ${bold ? 'font-semibold' : ''}`}>{label}</td>
      <td className={`py-1 text-right ${bold ? 'font-semibold' : ''}`}>{cur}</td>
      <td className={`py-1 text-right ${bold ? 'font-semibold' : ''}`}>{pro}</td>
    </tr>
  );
}

function Verdict({ s }: { s: NapkinScenarioOutput }) {
  const tone = s.verdict === 'below-ask' ? 'text-emerald-600' : s.verdict === 'paying-over-ask' ? 'text-red-600' : 'text-slate-600';
  const label =
    s.verdict === 'below-ask' ? `+${pct(s.pctVsAsk)} (under value)` : s.verdict === 'paying-over-ask' ? `${pct(s.pctVsAsk)} (over value)` : 'at value';
  return <span className={`font-semibold ${tone}`}>{label}</span>;
}

function Field({ label, value, onChange, step = 1, money, wide, info }: { label: string; value: number; onChange: (v: number) => void; step?: number; money?: boolean; wide?: boolean; info?: string }) {
  return (
    <label className={`block ${wide ? 'max-w-xs' : ''}`}>
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <div className="relative">
        {money && <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>}
        {money ? (
          <MoneyInput
            value={value}
            onChange={onChange}
            ariaLabel={label}
            className="w-full rounded-md border border-slate-300 py-1 pl-5 pr-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
          />
        ) : (
          <input
            type="number"
            value={value}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 py-1 px-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
          />
        )}
      </div>
    </label>
  );
}

function PctField({ label, value, onChange, info }: { label: string; value: number; onChange: (v: number) => void; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <div className="relative">
        <input
          type="number"
          value={+(value * 100).toFixed(2)}
          step={0.25}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full rounded-md border border-slate-300 py-1 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>
      </div>
    </label>
  );
}

function DecisionBtn({ children, active, tone, onClick }: { children: React.ReactNode; active: boolean; tone: 'emerald' | 'sky' | 'slate'; onClick: () => void }) {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium border transition';
  const styles = active
    ? { emerald: 'bg-emerald-600 text-white border-emerald-600', sky: 'bg-sky-600 text-white border-sky-600', slate: 'bg-slate-700 text-white border-slate-700' }[tone]
    : { emerald: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50', sky: 'border-sky-300 text-sky-700 hover:bg-sky-50', slate: 'border-slate-300 text-slate-700 hover:bg-slate-100' }[tone];
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
