'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { MoneyInput } from '@/components/MoneyInput';
import {
  BASIS_LABEL,
  defaultDetailedInputs,
  lineAmount,
  newLineId,
  pct,
  runDetailedUW,
  usd,
  type DetailedUWInputs,
  type LineBasis,
  type LineCtx,
  type LineItem,
  type MarketDeal,
} from '@/lib/sim';

interface Scenario { id: string; name: string; inputs: DetailedUWInputs }
interface Version { id: string; name: string; ts: number; inputs: DetailedUWInputs }

type ListKey = 'otherIncome' | 'expenses' | 'capexItems' | 'closingItems' | 'exitItems';

export function DetailedUWPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf, setStatus, statusOf } = useApp();
  const files = filesOf(deal.id);
  const hasT12 = files.some((f) => f.kind === 'T12');
  const hasRR = files.some((f) => f.kind === 'RentRoll');

  const [scenariosRaw, setScenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [
    { id: 'base', name: 'Base case', inputs: defaultDetailedInputs(deal) },
  ]);
  // normalize line items saved before the basis field existed (perUnit boolean → basis)
  const scenarios = scenariosRaw.map((s) => ({ ...s, inputs: normalizeInputs(s.inputs, deal) }));
  const [versions, setVersions] = useDealLocal<Version[]>('uw-versions-v2', deal.id, []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);

  const idx = Math.min(activeIdx, scenarios.length - 1);
  const active = scenarios[idx];
  const inp = active.inputs;

  const set = (patch: Partial<DetailedUWInputs>) =>
    setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, inputs: { ...s.inputs, ...patch } } : s)));

  const r = useMemo(() => runDetailedUW(inp), [inp]);
  const compareR = useMemo(() => (compareIdx != null && scenarios[compareIdx] ? runDetailedUW(scenarios[compareIdx].inputs) : null), [compareIdx, scenarios]);

  // display contexts for resolving line-item $ amounts (year-1)
  const loan = inp.financingType === 'new' ? Math.round(inp.purchasePrice * inp.ltv) : inp.loanAmount;
  const incCtx: LineCtx = { units: inp.units, price: inp.purchasePrice, loan, egi: 0 };
  const gpr1 = inp.avgRentMo * 12 * inp.units;
  const oi1 = inp.otherIncome.reduce((a, it) => a + lineAmount(it, incCtx), 0);
  const egi1 = (gpr1 + oi1) * (1 - inp.vacancy);
  const expCtx: LineCtx = { ...incCtx, egi: egi1 };

  // loan-assumption financing carried from the LOI stage
  const [loiRecord] = useDealLocal<{ financing: 'new' | 'assumption'; purchasePrice: number }>('loi', deal.id, { financing: 'new', purchasePrice: deal.askPrice });
  const loiSaysAssumption = loiRecord.financing === 'assumption' && inp.financingType !== 'assumption';

  // per-line, per-year proforma overrides — drives the integrated Statement table
  const setYearOverride = (lineId: string, year: number, value: number) => {
    const cur = inp.lineOverrides ?? {};
    set({ lineOverrides: { ...cur, [lineId]: { ...(cur[lineId] ?? {}), [year]: value } } });
  };
  const clearYearOverride = (lineId: string, year: number) => {
    const cur = inp.lineOverrides ?? {};
    const forLine = { ...(cur[lineId] ?? {}) };
    delete forLine[year];
    set({ lineOverrides: { ...cur, [lineId]: forLine } });
  };
  const isOverridden = (lineId: string, year: number) => inp.lineOverrides?.[lineId]?.[year] != null;

  // per-cell growth-assumption overrides (the % applied for that year's step).
  // Setting a growth % also clears any $ override on the same cell so the % drives the value
  // (and the displayed % stays accurate — owner 2026-06-10).
  const setGrowthOverride = (lineId: string, year: number, rate: number) => {
    const gCur = inp.growthOverrides ?? {};
    const cCur = inp.lineOverrides ?? {};
    const cashForLine = { ...(cCur[lineId] ?? {}) };
    delete cashForLine[year];
    set({
      growthOverrides: { ...gCur, [lineId]: { ...(gCur[lineId] ?? {}), [year]: rate } },
      lineOverrides: { ...cCur, [lineId]: cashForLine },
    });
  };
  const clearGrowthOverride = (lineId: string, year: number) => {
    const cur = inp.growthOverrides ?? {};
    const forLine = { ...(cur[lineId] ?? {}) };
    delete forLine[year];
    set({ growthOverrides: { ...cur, [lineId]: forLine } });
  };
  const isGrowthOverridden = (lineId: string, year: number) => inp.growthOverrides?.[lineId]?.[year] != null;

  // T-12 / T-6 / T-3 actuals reference column (hand-entered until AI parsing fills it)
  const setT12 = (lineId: string, v: number | undefined) => {
    const cur = { ...(inp.t12Ref ?? {}) };
    if (v == null || Number.isNaN(v)) delete cur[lineId];
    else cur[lineId] = v;
    set({ t12Ref: cur });
  };

  const anyOverrides =
    Object.values(inp.lineOverrides ?? {}).some((m) => Object.keys(m).length > 0) ||
    Object.values(inp.growthOverrides ?? {}).some((m) => Object.keys(m).length > 0);

  function nextScenarioName(): string {
    const nums = scenarios.map((s) => Number(/Scenario (\d+)/.exec(s.name)?.[1] ?? 0));
    return `Scenario ${Math.max(scenarios.length, ...nums) + 1}`;
  }
  function addScenario() {
    setScenarios((prev) => [...prev, { id: newLineId(), name: nextScenarioName(), inputs: { ...inp } }]);
    setActiveIdx(scenarios.length);
  }
  function renameScenario(name: string) { setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, name } : s))); }
  function deleteScenario() {
    if (scenarios.length <= 1) return;
    setScenarios((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx(0);
    setCompareIdx(null);
  }
  function saveVersion() {
    const name = prompt('Name this saved version:', `${active.name} — ${new Date().toLocaleDateString()}`);
    if (!name) return;
    setVersions((prev) => [{ id: newLineId(), name, ts: Date.now(), inputs: { ...inp } }, ...prev]);
  }
  function restoreVersion(v: Version) { setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, inputs: { ...v.inputs } } : s))); }

  const updateLine = (key: ListKey, id: string, patch: Partial<LineItem>) =>
    set({ [key]: inp[key].map((it) => (it.id === id ? { ...it, ...patch } : it)) } as Partial<DetailedUWInputs>);
  const addLine = (key: ListKey) =>
    set({ [key]: [...inp[key], { id: newLineId(), label: 'New item', amount: 0, basis: 'total' as LineBasis }] } as Partial<DetailedUWInputs>);
  const removeLine = (key: ListKey, id: string) =>
    set({ [key]: inp[key].filter((it) => it.id !== id) } as Partial<DetailedUWInputs>);

  const showSupp = inp.suppEnabled;
  const showSeller = inp.sellerEnabled;
  const showRefi = inp.refiEnabled;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Scenario bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scenarios</span>
        {scenarios.map((s, i) => (
          <button key={s.id} onClick={() => setActiveIdx(i)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${i === idx ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'}`}>{s.name}</button>
        ))}
        <button onClick={addScenario} className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">+ Duplicate</button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-slate-500">Compare scenario:</label>
          <select value={compareIdx ?? ''} onChange={(e) => setCompareIdx(e.target.value === '' ? null : Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none" disabled={scenarios.length < 2}>
            <option value="">{scenarios.length < 2 ? 'duplicate one to compare' : 'none'}</option>
            {scenarios.map((s, i) => (i === idx ? null : <option key={s.id} value={i}>{s.name}</option>))}
          </select>
          <button onClick={saveVersion} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">💾 Save version</button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
        <input value={active.name} onChange={(e) => renameScenario(e.target.value)} className="rounded-md border border-transparent px-1 py-0.5 text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
        {scenarios.length > 1 && <button onClick={deleteScenario} className="text-xs text-red-500 underline hover:text-red-700">delete scenario</button>}
        <button onClick={() => set(defaultDetailedInputs(deal))} className="ml-auto text-xs text-slate-500 underline hover:text-slate-900">Reset assumptions</button>
      </div>

      {/* Sticky section nav — jump anywhere, always know where you are */}
      <SectionNav />

      {/* KPI band */}
      <div className="border-b border-slate-100 bg-slate-50 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h2 className="text-xl font-bold">Detailed Underwriting</h2>
          <InfoTip k="step.detailed" />
        </div>
        {(r.seniorMaturesEarly || r.sellerMaturesEarly) && (
          <div className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            ⚠ {r.seniorMaturesEarly && `Senior loan matures in year ${inp.loanTermYears} — before your ${r.hold}-year exit, with no refinance. Add a refi or shorten the hold.`}
            {r.seniorMaturesEarly && r.sellerMaturesEarly && ' '}
            {r.sellerMaturesEarly && `Seller note balloons in year ${inp.sellerTermYears}, before exit — plan a payoff/refi.`}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Purchase price" value={usd(inp.purchasePrice, { compact: true })} />
          <Kpi label="Levered IRR" info="r.irr" value={pct(r.leveredIRR)} tone={tone(r.leveredIRR, 0.15, 0.1)} big />
          <Kpi label="Equity multiple" info="r.em" value={`${r.equityMultiple.toFixed(2)}x`} big />
          <Kpi label="Avg cash-on-cash" info="r.coc" value={pct(r.avgCashOnCash)} big />
          <Kpi label="LP IRR" value={pct(r.lpIRR)} tone={tone(r.lpIRR, 0.13, 0.09)} />
          <Kpi label="LP equity multiple" value={`${r.lpEquityMultiple.toFixed(2)}x`} />
          {inp.prefEquityEnabled && <Kpi label="Pref IRR" info="f.prefEquity" value={pct(r.prefIRR)} />}
          <Kpi label="GP profit" info="r.promote" value={usd(r.gpProfit, { compact: true })} />
          <Kpi label="Project (unlevered) IRR" value={pct(r.projectIRR)} />
          <Kpi label="Going-in cap" info="m.walkInCap" value={pct(r.goingInCap)} />
          <Kpi label="Yr-1 DSCR" info="m.dscr" value={r.year1DSCR.toFixed(2)} tone={r.year1DSCR >= 1.25 ? 'good' : 'bad'} />
          <Kpi label="Equity required" value={usd(r.equityRequired, { compact: true })} />
        </div>
      </div>

      {/* Comparison */}
      {compareR && compareIdx != null && (
        <div className="border-b border-slate-100 p-4">
          <h3 className="mb-1 text-base font-bold">Scenario comparison</h3>
          <p className="mb-2 text-[11px] text-slate-500">Comparing the <b>active scenario</b> ({active.name}) against <b>{scenarios[compareIdx].name}</b>. (Saved versions are separate — see the bottom of the page.)</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs text-slate-500"><tr>
                <th className="py-1 text-left font-medium">Metric</th>
                <th className="py-1 text-right font-medium">{active.name}</th>
                <th className="py-1 text-right font-medium">{scenarios[compareIdx].name}</th>
                <th className="py-1 text-right font-medium">Δ</th>
              </tr></thead>
              <tbody className="tabular-nums">
                <CmpRow label="Levered IRR" a={r.leveredIRR} b={compareR.leveredIRR} fmt={pct} />
                <CmpRow label="Equity multiple" a={r.equityMultiple} b={compareR.equityMultiple} fmt={(v) => `${v.toFixed(2)}x`} />
                <CmpRow label="LP IRR" a={r.lpIRR} b={compareR.lpIRR} fmt={pct} />
                <CmpRow label="Avg cash-on-cash" a={r.avgCashOnCash} b={compareR.avgCashOnCash} fmt={pct} />
                <CmpRow label="Yr-1 DSCR" a={r.year1DSCR} b={compareR.year1DSCR} fmt={(v) => v.toFixed(2)} />
                <CmpRow label="Equity required" a={r.equityRequired} b={compareR.equityRequired} fmt={(v) => usd(v, { compact: true })} invert />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Files */}
      <div className="border-b border-slate-100 p-4">
        <div className="grid grid-cols-2 gap-2">
          <FileStatus ok={hasT12} label="T-12" />
          <FileStatus ok={hasRR} label="Rent roll" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Upload the T-12 + rent roll on the deal&apos;s Files; AI parsing (next) will auto-populate the line items below.</p>
      </div>

      {/* Income | Expenses — side by side on wide screens */}
      <div className="grid grid-cols-1 border-b border-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-slate-200">
      <Section id="uw-income" title="Income" info="m.noi" color="emerald">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money label="Avg rent /mo" info="m.marketRent" v={inp.avgRentMo} onChange={(v) => set({ avgRentMo: v })} />
          <Pct label="Vacancy" info="m.vacancy" v={inp.vacancy} onChange={(v) => set({ vacancy: v })} />
          <Pct label="Rent growth" v={inp.rentGrowthPct} onChange={(v) => set({ rentGrowthPct: v })} />
          <Pct label="Other-income growth" v={inp.otherIncomeGrowthPct} onChange={(v) => set({ otherIncomeGrowthPct: v })} />
        </div>
        <LineItems title="Other income" info="m.otherIncome" items={inp.otherIncome} ctx={incCtx} onChange={(id, p) => updateLine('otherIncome', id, p)} onAdd={() => addLine('otherIncome')} onRemove={(id) => removeLine('otherIncome', id)} />
      </Section>

      {/* Expenses */}
      <Section id="uw-expenses" title="Operating expenses" info="m.expenseRatio" color="amber">
        <Pct label="Expense growth" v={inp.expenseGrowthPct} onChange={(v) => set({ expenseGrowthPct: v })} />
        <LineItems title="Expense line items" info="m.expensePerUnit" items={inp.expenses} ctx={expCtx} onChange={(id, p) => updateLine('expenses', id, p)} onAdd={() => addLine('expenses')} onRemove={(id) => removeLine('expenses', id)} />
      </Section>
      </div>

      {/* Capital */}
      <Section id="uw-capital" title="Capital plan & uses" info="c.capex" color="indigo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money label="Purchase price" v={inp.purchasePrice} step={100_000} onChange={(v) => set({ purchasePrice: v })} />
          <Pct label="Acq fee" info="c.acqFee" v={inp.acqFeePct} onChange={(v) => set({ acqFeePct: v })} />
          <Money label="Reserves /unit" info="c.reserves" v={inp.reservesPerUnit} step={50} onChange={(v) => set({ reservesPerUnit: v })} />
        </div>
        <LineItems title="CapEx" info="c.capex" items={inp.capexItems} ctx={incCtx} onChange={(id, p) => updateLine('capexItems', id, p)} onAdd={() => addLine('capexItems')} onRemove={(id) => removeLine('capexItems', id)} />
        <LineItems title="Closing costs" info="c.closingCosts" items={inp.closingItems} ctx={incCtx} onChange={(id, p) => updateLine('closingItems', id, p)} onAdd={() => addLine('closingItems')} onRemove={(id) => removeLine('closingItems', id)} />
      </Section>

      {/* Financing */}
      <Section id="uw-financing" title="Financing — debt stack" info="f.ltv" color="sky">
        {loiSaysAssumption && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>Your LOI specifies a <b>loan assumption</b> — apply it here?</span>
            <button onClick={() => set({ financingType: 'assumption' })} className="ml-auto rounded-md border border-amber-400 px-2 py-1 font-medium hover:bg-amber-100">Apply assumption</button>
          </div>
        )}
        <div className="mb-3 flex rounded-lg border border-slate-300 p-0.5 text-xs font-medium">
          <button onClick={() => set({ financingType: 'new' })} className={`flex-1 rounded-md px-3 py-1.5 ${inp.financingType === 'new' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>New loan (size to LTV)</button>
          <button onClick={() => set({ financingType: 'assumption' })} className={`flex-1 rounded-md px-3 py-1.5 ${inp.financingType === 'assumption' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Loan assumption (from LOI)</button>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {inp.financingType === 'new' ? (
            <>
              <Pct label="LTV" info="f.ltv" v={inp.ltv} onChange={(v) => set({ ltv: v })} />
              <Plain label="Loan (derived)" value={usd(loan, { compact: true })} />
            </>
          ) : (
            <Money label="Assumed loan $" info="f.assumption" v={inp.loanAmount} step={100_000} onChange={(v) => set({ loanAmount: v })} />
          )}
          <Pct label="Rate" info="f.interestRate" v={inp.interestRate} onChange={(v) => set({ interestRate: v })} />
          <Num label="IO mo" info="f.io" v={inp.ioMonths} step={6} onChange={(v) => set({ ioMonths: v })} />
          <Num label="Amort mo" info="f.amort" v={inp.amortMonths} step={12} onChange={(v) => set({ amortMonths: v })} />
          <Num label="Term (yrs)" v={inp.loanTermYears} onChange={(v) => set({ loanTermYears: v })} />
        </div>

        <Toggle label="Supplemental loan" info="f.supplemental" on={inp.suppEnabled} onToggle={(v) => set({ suppEnabled: v })}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Money label="Amount" v={inp.suppAmount} step={50_000} onChange={(v) => set({ suppAmount: v })} />
            <Pct label="Rate" v={inp.suppRate} onChange={(v) => set({ suppRate: v })} />
            <Num label="Fund in year (0=close)" v={inp.suppFundYear} onChange={(v) => set({ suppFundYear: v })} />
            <Num label="Amort months" v={inp.suppAmortMonths} step={12} onChange={(v) => set({ suppAmortMonths: v })} />
          </div>
        </Toggle>

        <Toggle label="Seller financing" info="f.sellerFinancing" on={inp.sellerEnabled} onToggle={(v) => set({ sellerEnabled: v })}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Money label="Note amount" v={inp.sellerAmount} step={50_000} onChange={(v) => set({ sellerAmount: v })} />
            <Pct label="Rate" v={inp.sellerRate} onChange={(v) => set({ sellerRate: v })} />
            <Num label="Amort months" v={inp.sellerAmortMonths} step={12} onChange={(v) => set({ sellerAmortMonths: v })} />
            <Num label="Term (yrs, balloon)" v={inp.sellerTermYears} onChange={(v) => set({ sellerTermYears: v })} />
          </div>
        </Toggle>

        <Toggle label="Refinance during hold" info="f.refi" on={inp.refiEnabled} onToggle={(v) => set({ refiEnabled: v })}>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            <Num label="Refi in year" v={inp.refiYear} onChange={(v) => set({ refiYear: v })} />
            <Pct label="Refi LTV" v={inp.refiLtv} onChange={(v) => set({ refiLtv: v })} />
            <Pct label="Refi cap (value)" v={inp.refiCapRate} onChange={(v) => set({ refiCapRate: v })} />
            <Pct label="Refi rate" v={inp.refiRate} onChange={(v) => set({ refiRate: v })} />
            <Num label="Amort months" v={inp.refiAmortMonths} step={12} onChange={(v) => set({ refiAmortMonths: v })} />
            <Pct label="Refi cost" v={inp.refiCostPct} onChange={(v) => set({ refiCostPct: v })} />
          </div>
          {inp.refiEnabled && <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">New loan {usd(r.refiNewLoan, { compact: true })} − payoff {usd(r.refiPayoff, { compact: true })} → <b>cash-out {usd(r.refiNetCashOut, { compact: true })}</b> in year {inp.refiYear}.</div>}
        </Toggle>
      </Section>

      {/* Equity | Exit — side by side on wide screens */}
      <div className="grid grid-cols-1 border-b border-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-slate-200">
      <Section id="uw-equity" title="Equity stack & waterfall" info="r.waterfall" color="violet">
        <Toggle label="Use preferred equity" info="f.prefEquity" on={inp.prefEquityEnabled} onToggle={(v) => set({ prefEquityEnabled: v })}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Pct label="% of equity from pref" v={inp.prefEquityPct} onChange={(v) => set({ prefEquityPct: v })} />
            <Pct label="Current pay rate" info="f.prefEquity" v={inp.prefCurrentRate} onChange={(v) => set({ prefCurrentRate: v })} />
            <Pct label="Accrued (carry) rate" info="r.prefReturn" v={inp.prefAccrueRate} onChange={(v) => set({ prefAccrueRate: v })} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Current pay is served monthly from operating cash; the accrued rate compounds and is paid at a capital event (refi/sale). Total pref ≈ {pct(inp.prefCurrentRate + inp.prefAccrueRate)}.</p>
        </Toggle>

        <div className="mt-3 rounded-lg border-2 border-violet-200 bg-violet-50/30 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">Common equity & promote</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Pct label="GP co-invest" v={inp.gpCoinvestPct} onChange={(v) => set({ gpCoinvestPct: v })} />
            <Pct label="LP pref return (hurdle)" info="r.prefReturn" v={inp.lpPrefReturn} onChange={(v) => set({ lpPrefReturn: v })} />
            <Pct label="Promote to GP" info="r.promote" v={inp.promoteToGp} onChange={(v) => set({ promoteToGp: v })} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Pref equity" value={usd(r.prefEquity, { compact: true })} />
          <Stat label="LP equity" value={usd(r.lpEquity, { compact: true })} />
          <Stat label="GP equity" value={usd(r.gpEquity, { compact: true })} />
          <Stat label="GP multiple" value={`${r.gpMultiple.toFixed(2)}x`} />
        </div>
      </Section>

      {/* Exit */}
      <Section id="uw-exit" title="Exit" info="c.hold" color="rose">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Hold (years, max 12)" info="c.hold" v={inp.holdYears} onChange={(v) => set({ holdYears: v })} />
          <Pct label="Exit cap" info="m.stabilizedCap" v={inp.exitCapRate} onChange={(v) => set({ exitCapRate: v })} />
          <Pct label="Sale cost %" info="c.exitCosts" v={inp.saleCostPct} onChange={(v) => set({ saleCostPct: v })} />
        </div>
        <LineItems title="Other exit costs" info="c.exitCosts" items={inp.exitItems} ctx={incCtx} onChange={(id, p) => updateLine('exitItems', id, p)} onAdd={() => addLine('exitItems')} onRemove={(id) => removeLine('exitItems', id)} />
      </Section>
      </div>

      {/* THE STATEMENT — one integrated proforma, Synthesis-style: income lines → NOI → debt →
          cash flow → capital events → distributions. Every other area reads off this. */}
      <section id="uw-statement" className="scroll-mt-28 border-b border-slate-200">
        <div className={`flex flex-wrap items-center gap-2 px-4 py-2 ${SECTION_COLOR.slate.header}`}>
          <h3 className="text-base font-bold text-white">Proforma statement — every line, every year</h3>
          {anyOverrides && (
            <button onClick={() => set({ lineOverrides: {}, growthOverrides: {} })} className="ml-auto rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/30">
              clear cell overrides
            </button>
          )}
        </div>
        <div className="p-4">
          <p className="mb-2 text-[11px] text-slate-500">
            <b className="text-indigo-600">T-12</b> = actuals reference (hand-enter now; auto-filled with a mapping review once AI parsing reads your uploads).
            In each year cell the small % on top is the growth applied that year — edit it to override <i>just that year&apos;s step</i> (teal).
            Edit the $ below to set that year directly (amber) — the % then shows the <i>implied</i> growth, so what you see is always accurate.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 220 + 90 + r.hold * 88 }}>
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-left font-medium">Line</th>
                  <th className="py-1 pr-2 text-right font-medium text-indigo-600">T-12 ref</th>
                  {r.years.map((y) => (<th key={y.year} className="py-1 text-right font-medium">Y{y.year}</th>))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <BandRow label={`Income · growth ${(inp.otherIncomeGrowthPct * 100).toFixed(1)}%/yr`} color="bg-emerald-50 text-emerald-700" cols={r.hold + 2} />
                <StmtRow label="Gross potential rent" cells={r.years.map((y) => usd(y.gpr, { compact: true }))} />
                {inp.otherIncome.map((it) => (
                  <StmtLineRow key={it.id} label={it.label} values={r.incomeDetail[it.id] ?? []} lineId={it.id}
                    t12={inp.t12Ref?.[it.id]} onSetT12={setT12}
                    isOverridden={isOverridden} onSet={setYearOverride} onClear={clearYearOverride}
                    isGrowthOverridden={isGrowthOverridden} onSetGrowth={setGrowthOverride} onClearGrowth={clearGrowthOverride} />
                ))}
                <StmtRow label={`Vacancy loss (${(inp.vacancy * 100).toFixed(1)}%)`} muted cells={r.years.map((y) => `(${usd((y.gpr + y.otherIncome) * inp.vacancy, { compact: true })})`)} />
                <StmtRow label="Effective gross income" bold cells={r.years.map((y) => usd(y.egi, { compact: true }))} />

                <BandRow label={`Operating expenses · growth ${(inp.expenseGrowthPct * 100).toFixed(1)}%/yr`} color="bg-amber-50 text-amber-700" cols={r.hold + 2} />
                {inp.expenses.map((it) => (
                  <StmtLineRow key={it.id} label={it.label} values={r.expenseDetail[it.id] ?? []} lineId={it.id}
                    t12={inp.t12Ref?.[it.id]} onSetT12={setT12}
                    isOverridden={isOverridden} onSet={setYearOverride} onClear={clearYearOverride}
                    isGrowthOverridden={isGrowthOverridden} onSetGrowth={setGrowthOverride} onClearGrowth={clearGrowthOverride} />
                ))}
                <StmtRow label="Total operating expenses" bold cells={r.years.map((y) => usd(y.opex, { compact: true }))} />
                <StmtRow label="NET OPERATING INCOME" strong cells={r.years.map((y) => usd(y.noi, { compact: true }))} />

                <BandRow label="Debt service" color="bg-sky-50 text-sky-700" cols={r.hold + 2} />
                <StmtRow label="1st lien (senior)" muted cells={r.years.map((y) => usd(y.dsSenior, { compact: true }))} />
                {showSupp && <StmtRow label="Supplemental" muted cells={r.years.map((y) => usd(y.dsSupp, { compact: true }))} />}
                {showSeller && <StmtRow label="Seller note" muted cells={r.years.map((y) => usd(y.dsSeller, { compact: true }))} />}
                {showRefi && <StmtRow label="Refi loan" muted cells={r.years.map((y) => usd(y.dsRefi, { compact: true }))} />}
                <StmtRow label="Total debt service" bold cells={r.years.map((y) => usd(y.debtService, { compact: true }))} />
                <StmtRow label="DSCR" muted cells={r.years.map((y) => y.dscr.toFixed(2))} />
                <StmtRow label="CASH FLOW AFTER DEBT" strong cells={r.years.map((y) => usd(y.cashFlow, { compact: true }))} />

                <BandRow label="Capital events" color="bg-indigo-50 text-indigo-700" cols={r.hold + 2} />
                <StmtRow label="Refi / supplemental proceeds" muted cells={r.years.map((y) => (y.financingProceeds ? usd(y.financingProceeds, { compact: true }) : '—'))} />
                <StmtRow label="Net sale proceeds (exit)" muted cells={r.years.map((y) => (y.year === r.hold ? usd(r.netSaleProceeds, { compact: true }) : '—'))} />

                <BandRow label="Distributions" color="bg-violet-50 text-violet-700" cols={r.hold + 2} />
                {inp.prefEquityEnabled && <StmtRow label="Preferred (current + carry)" cells={r.waterfall.map((w) => usd(w.pref, { compact: true }))} />}
                <StmtRow label="LP distributions" bold cells={r.waterfall.map((w) => usd(w.lp, { compact: true }))} />
                <StmtRow label="GP distributions" cells={r.waterfall.map((w) => usd(w.gp, { compact: true }))} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sample investor return */}
      <div id="uw-investor" className="scroll-mt-28 border-b border-slate-100 p-4">
        <h3 className="mb-2 text-base font-bold">Sample investor return</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Money label="If an LP invests" v={inp.sampleInvestment} step={25_000} onChange={(v) => set({ sampleInvestment: v })} />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total returned" value={usd(r.sampleReturn.totalReturned, { compact: true })} />
            <Stat label="Profit" value={usd(r.sampleReturn.profit, { compact: true })} />
            <Stat label="IRR" value={pct(r.sampleReturn.irr)} />
            <Stat label="Equity multiple" value={`${r.sampleReturn.equityMultiple.toFixed(2)}x`} />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">This LP rides the LP class pro-rata. (Powerpoint investor one-pagers generated from this come later.)</p>
      </div>

      {/* Sources & uses + exit */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Sources &amp; Uses</h4>
          <Line k="Purchase price" v={usd(inp.purchasePrice)} />
          <Line k="Acq fee" v={usd(r.acqFee)} />
          <Line k="Closing + capex + reserves" v={usd(r.totalUses - inp.purchasePrice - r.acqFee)} />
          <Line k="Total uses" v={usd(r.totalUses)} bold />
          <Line k="Debt at close" v={usd(r.debtAtClose)} />
          <Line k="Equity required" v={usd(r.equityRequired)} bold />
        </div>
        <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Exit (Year {r.hold})</h4>
          <Line k="Forward NOI" v={usd(r.exitNOI)} />
          <Line k={`Sale @ ${pct(inp.exitCapRate)} cap`} v={usd(r.salePrice)} bold />
          <Line k="Sale costs" v={`(${usd(r.saleCosts)})`} />
          <Line k="Debt payoff" v={`(${usd(r.debtPayoffAtExit)})`} />
          <Line k="Net sale proceeds" v={usd(r.netSaleProceeds)} bold />
        </div>
      </div>

      {/* Saved versions */}
      {versions.length > 0 && (
        <div className="border-t border-slate-100 p-4">
          <h3 className="mb-1 text-base font-bold">Saved versions</h3>
          <p className="mb-2 text-[11px] text-slate-500">Point-in-time snapshots (separate from scenarios). Restore one into the active scenario.</p>
          <ul className="space-y-1">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm">
                <span className="text-slate-700">{v.name}</span>
                <span className="text-[11px] text-slate-400">{new Date(v.ts).toLocaleString()}</span>
                <button onClick={() => restoreVersion(v)} className="ml-auto text-xs text-sky-600 underline hover:text-sky-800">Restore into {active.name}</button>
                <button onClick={() => setVersions((prev) => prev.filter((x) => x.id !== v.id))} className="text-xs text-red-500 underline hover:text-red-700">delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-100 p-4">
        <button onClick={() => setStatus(deal.id, 'loi')} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          {statusOf(deal.id) === 'detailed' || statusOf(deal.id) === 'napkin' ? 'Proceed to LOI →' : 'Go to LOI →'}
        </button>
        <p className="mt-2 text-xs text-slate-500">Returns look workable? Advance to the Letter of Intent to make your offer.</p>
      </div>
    </section>
  );
}

function tone(v: number, good: number, ok: number): 'good' | 'ok' | 'bad' { return v >= good ? 'good' : v >= ok ? 'ok' : 'bad'; }

/** Heal inputs saved by older versions: missing basis on line items, missing newer fields. */
function normalizeInputs(inp: DetailedUWInputs, deal: MarketDeal): DetailedUWInputs {
  const fix = (items: LineItem[] | undefined, fallback: LineItem[]): LineItem[] => {
    if (!items || !Array.isArray(items) || items.length === 0) return fallback;
    return items.map((it) => {
      if (it.basis) return it;
      const legacy = it as LineItem & { perUnit?: boolean };
      return { ...it, basis: legacy.perUnit ? 'perUnit' : 'total' };
    });
  };
  const d = defaultDetailedInputs(deal);
  return {
    ...d,
    ...inp,
    otherIncome: fix(inp.otherIncome, d.otherIncome),
    expenses: fix(inp.expenses, d.expenses),
    capexItems: fix(inp.capexItems, d.capexItems),
    closingItems: fix(inp.closingItems, d.closingItems),
    exitItems: fix(inp.exitItems, d.exitItems),
  };
}

// Synthesis-style SOLID section headers — instantly identifiable while scrolling.
const SECTION_COLOR: Record<string, { header: string; chip: string }> = {
  emerald: { header: 'bg-emerald-600', chip: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
  amber: { header: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  indigo: { header: 'bg-indigo-600', chip: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' },
  sky: { header: 'bg-sky-600', chip: 'bg-sky-100 text-sky-800 hover:bg-sky-200' },
  violet: { header: 'bg-violet-600', chip: 'bg-violet-100 text-violet-800 hover:bg-violet-200' },
  rose: { header: 'bg-rose-600', chip: 'bg-rose-100 text-rose-800 hover:bg-rose-200' },
  teal: { header: 'bg-teal-600', chip: 'bg-teal-100 text-teal-800 hover:bg-teal-200' },
  slate: { header: 'bg-slate-700', chip: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
};

const UW_SECTIONS: [string, string, string][] = [
  ['uw-income', 'Income', 'emerald'],
  ['uw-expenses', 'Expenses', 'amber'],
  ['uw-financing', 'Financing', 'sky'],
  ['uw-capital', 'Capital', 'indigo'],
  ['uw-equity', 'Equity', 'violet'],
  ['uw-exit', 'Exit', 'rose'],
  ['uw-statement', 'Statement', 'slate'],
  ['uw-investor', 'Investor', 'emerald'],
];

function SectionNav() {
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur">
      {UW_SECTIONS.map(([id, label, color]) => (
        <button key={id} onClick={() => go(id)} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SECTION_COLOR[color].chip}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Section({ id, title, info, color, children }: { id?: string; title: string; info?: string; color: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className={`flex items-center gap-1.5 px-4 py-2 ${SECTION_COLOR[color].header}`}>
        <h3 className="text-base font-bold text-white">{title}</h3>
        {info && <span className="brightness-200"><InfoTip k={info} /></span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LineItems({
  title,
  info,
  items,
  ctx,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  info?: string;
  items: LineItem[];
  ctx: LineCtx;
  onChange: (id: string, patch: Partial<LineItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const total = items.reduce((a, it) => a + lineAmount(it, ctx), 0);
  const isPct = (b: LineBasis) => b === 'pctPrice' || b === 'pctLoan' || b === 'pctEGI' || b === 'millage';
  return (
    <div className="mt-3 rounded-lg border-2 border-slate-200 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-600">{title}</span>
        {info && <InfoTip k={info} />}
        <span className="ml-auto text-xs font-semibold tabular-nums text-slate-700">{usd(total)}/yr</span>
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center gap-2">
            <input value={it.label} onChange={(e) => onChange(it.id, { label: e.target.value })} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none" />
            <div className="relative w-24 shrink-0">
              {!isPct(it.basis) && <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>}
              <input
                type="number"
                value={isPct(it.basis) ? +(it.amount * 100).toFixed(3) : it.amount}
                onChange={(e) => onChange(it.id, { amount: isPct(it.basis) ? Number(e.target.value) / 100 : Number(e.target.value) })}
                className={`w-full rounded-md border border-slate-200 py-1 text-xs tabular-nums focus:border-slate-400 focus:outline-none ${isPct(it.basis) ? 'pl-2 pr-5' : 'pl-5 pr-2'}`}
              />
              {isPct(it.basis) && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>}
            </div>
            <select value={it.basis} onChange={(e) => { const b = e.target.value as LineBasis; onChange(it.id, { basis: b, assessedRatio: b === 'millage' ? it.assessedRatio ?? 0.8 : it.assessedRatio }); }} className="shrink-0 rounded-md border border-slate-200 px-1 py-1 text-[11px] focus:outline-none">
              {(Object.keys(BASIS_LABEL) as LineBasis[]).map((b) => (<option key={b} value={b}>{BASIS_LABEL[b]}</option>))}
            </select>
            {it.basis === 'millage' && (
              <div className="relative w-20 shrink-0" title="Assessed value as % of price">
                <input type="number" value={+(((it.assessedRatio ?? 0.8) * 100)).toFixed(0)} onChange={(e) => onChange(it.id, { assessedRatio: Number(e.target.value) / 100 })} className="w-full rounded-md border border-slate-200 py-1 pl-2 pr-5 text-xs tabular-nums focus:outline-none" />
                <span className="pointer-events-none absolute right-1.5 top-1.5 text-[10px] text-slate-400">%av</span>
              </div>
            )}
            <span className="shrink-0 text-[11px] tabular-nums text-slate-500">= {usd(lineAmount(it, ctx), { compact: true })}</span>
            <button onClick={() => onRemove(it.id)} className="shrink-0 text-slate-300 hover:text-red-500" title="Remove">✕</button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100">+ Add line item</button>
    </div>
  );
}

function Toggle({ label, info, on, onToggle, children }: { label: string; info?: string; on: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-2 border-slate-200">
      <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {info && <InfoTip k={info} />}
      </label>
      {on && <div className="border-t border-slate-100 p-3">{children}</div>}
    </div>
  );
}

function Kpi({ label, value, big, tone, info }: { label: string; value: string; big?: boolean; tone?: 'good' | 'ok' | 'bad'; info?: string }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'ok' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">{label}{info && <InfoTip k={info} />}</div>
      <div className={`font-semibold ${big ? 'text-lg' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  );
}

function CmpRow({ label, a, b, fmt, invert }: { label: string; a: number; b: number; fmt: (v: number) => string; invert?: boolean }) {
  const delta = a - b;
  const better = invert ? delta < 0 : delta > 0;
  const tcolor = Math.abs(delta) < 1e-9 ? 'text-slate-400' : better ? 'text-emerald-600' : 'text-red-600';
  return (
    <tr className="border-t border-slate-50">
      <td className="py-1 text-left">{label}</td>
      <td className="py-1 text-right font-semibold">{fmt(a)}</td>
      <td className="py-1 text-right text-slate-600">{fmt(b)}</td>
      <td className={`py-1 text-right ${tcolor}`}>{delta >= 0 ? '+' : ''}{fmt(delta)}</td>
    </tr>
  );
}

function FileStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
      <span>{ok ? '✓' : '!'}</span><span>{label}</span><span className="ml-auto text-xs">{ok ? 'uploaded' : 'needed'}</span>
    </div>
  );
}

function Money({ label, v, onChange, info }: { label: string; v: number; onChange: (n: number) => void; step?: number; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>
        <MoneyInput value={v} onChange={onChange} ariaLabel={label} className="w-full rounded-md border border-slate-300 py-1 pl-5 pr-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
      </div>
    </label>
  );
}

function Num({ label, v, onChange, step = 1, info }: { label: string; v: number; onChange: (n: number) => void; step?: number; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <input type="number" value={v} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
    </label>
  );
}

function Pct({ label, v, onChange, info }: { label: string; v: number; onChange: (n: number) => void; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <div className="relative">
        <input type="number" value={+(v * 100).toFixed(2)} step={0.25} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full rounded-md border border-slate-300 py-1 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
        <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>
      </div>
    </label>
  );
}

function Plain({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">{value}</div>
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

/** Full-width colored band that introduces a block of the statement (Synthesis-style). */
function BandRow({ label, color, cols }: { label: string; color: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols + 1} className={`px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</td>
    </tr>
  );
}

/** Computed statement row: label · T-12 ref (display) · year cells. */
function StmtRow({ label, cells, t12, bold, muted, strong }: { label: string; cells: string[]; t12?: string; bold?: boolean; muted?: boolean; strong?: boolean }) {
  return (
    <tr className={`border-t border-slate-100 ${muted ? 'text-slate-500' : ''} ${strong ? 'bg-emerald-50' : ''}`}>
      <td className={`py-1 pr-2 text-left ${bold || strong ? 'font-bold' : ''}`}>{label}</td>
      <td className="py-1 pr-2 text-right text-indigo-400">{t12 ?? '—'}</td>
      {cells.map((c, i) => (<td key={i} className={`py-1 pl-1 text-right ${bold || strong ? 'font-bold' : ''}`}>{c}</td>))}
    </tr>
  );
}

/** Editable line row: label · editable T-12 ref · year cells (implied-% on top, $ below). */
function StmtLineRow({
  label,
  values,
  lineId,
  t12,
  onSetT12,
  isOverridden,
  onSet,
  onClear,
  isGrowthOverridden,
  onSetGrowth,
  onClearGrowth,
}: {
  label: string;
  values: number[];
  lineId: string;
  t12?: number;
  onSetT12: (lineId: string, v: number | undefined) => void;
  isOverridden: (lineId: string, year: number) => boolean;
  onSet: (lineId: string, year: number, value: number) => void;
  onClear: (lineId: string, year: number) => void;
  isGrowthOverridden: (lineId: string, year: number) => boolean;
  onSetGrowth: (lineId: string, year: number, rate: number) => void;
  onClearGrowth: (lineId: string, year: number) => void;
}) {
  return (
    <tr className="border-t border-slate-100 align-bottom">
      <td className="py-1.5 pr-2 text-left text-slate-700">{label}</td>
      {/* T-12 actuals reference — the anchor the proforma is judged against */}
      <td className="py-1.5 pr-2 text-right">
        <input
          type="number"
          value={t12 ?? ''}
          placeholder="—"
          onChange={(e) => onSetT12(lineId, e.target.value === '' ? undefined : Number(e.target.value))}
          title="T-12 / T-6 / T-3 actual (annualized). Auto-fills when AI parsing reads your uploads."
          className="w-20 rounded border border-indigo-200 bg-indigo-50/50 py-0.5 pl-1 pr-1 text-right text-xs tabular-nums text-indigo-700 placeholder:text-indigo-300 focus:border-indigo-400 focus:outline-none"
        />
      </td>
      {values.map((v, idx) => {
        const year = idx + 1;
        const cashOver = isOverridden(lineId, year);
        const gOver = isGrowthOverridden(lineId, year);
        // displayed % = IMPLIED growth from the prior year — accurate no matter which side was edited
        const prev = idx > 0 ? values[idx - 1] : 0;
        const implied = idx > 0 && prev !== 0 ? v / prev - 1 : 0;
        return (
          <td key={year} className="py-1.5 pl-1 text-right">
            <div className="inline-flex flex-col items-end gap-0.5">
              {year === 1 ? (
                <span className="pr-1 text-[9px] uppercase tracking-wide text-slate-400">base</span>
              ) : (
                <span className="inline-flex items-center">
                  <input
                    type="number"
                    value={+(implied * 100).toFixed(2)}
                    step={0.25}
                    onChange={(e) => onSetGrowth(lineId, year, Number(e.target.value) / 100)}
                    title={gOver ? 'Growth override for this year (compounds forward)' : cashOver ? 'Implied growth (derived from the $ you set)' : 'Growth applied this year — edit to override just this step'}
                    className={`w-14 rounded border py-0 pl-1 pr-0.5 text-right text-[10px] tabular-nums focus:outline-none ${
                      gOver ? 'border-teal-400 bg-teal-50 font-bold text-teal-800' : cashOver ? 'border-amber-200 bg-amber-50/50 font-semibold italic text-amber-700' : 'border-transparent bg-transparent text-slate-400 hover:border-slate-200'
                    }`}
                  />
                  <span className={`text-[9px] ${gOver ? 'text-teal-700' : cashOver ? 'text-amber-600' : 'text-slate-400'}`}>%</span>
                  {gOver && <button onClick={() => onClearGrowth(lineId, year)} className="ml-0.5 text-[9px] text-teal-500 hover:text-red-500" title="Revert to global growth">✕</button>}
                </span>
              )}
              <span className="inline-flex items-center">
                <input
                  type="number"
                  value={Math.round(v)}
                  onChange={(e) => onSet(lineId, year, Number(e.target.value))}
                  className={`w-20 rounded border py-0.5 pl-1 pr-1 text-right text-xs tabular-nums focus:outline-none ${cashOver ? 'border-amber-400 bg-amber-50 font-semibold text-amber-800' : 'border-slate-200 text-slate-600'}`}
                />
                {cashOver && <button onClick={() => onClear(lineId, year)} className="ml-0.5 text-[10px] text-amber-500 hover:text-red-500" title="Revert to calculated">✕</button>}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-slate-100 py-0.5 text-xs ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
      <span>{k}</span><span className="tabular-nums">{v}</span>
    </div>
  );
}
