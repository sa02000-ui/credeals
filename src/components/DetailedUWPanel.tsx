'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
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

  const [scenarios, setScenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [
    { id: 'base', name: 'Base case', inputs: defaultDetailedInputs(deal) },
  ]);
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

      {/* Income */}
      <Section title="Income" info="m.noi" color="emerald">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money label="Avg rent /mo" info="m.marketRent" v={inp.avgRentMo} onChange={(v) => set({ avgRentMo: v })} />
          <Pct label="Vacancy" info="m.vacancy" v={inp.vacancy} onChange={(v) => set({ vacancy: v })} />
          <Pct label="Rent growth" v={inp.rentGrowthPct} onChange={(v) => set({ rentGrowthPct: v })} />
          <Pct label="Other-income growth" v={inp.otherIncomeGrowthPct} onChange={(v) => set({ otherIncomeGrowthPct: v })} />
        </div>
        <LineItems title="Other income" info="m.otherIncome" items={inp.otherIncome} ctx={incCtx} onChange={(id, p) => updateLine('otherIncome', id, p)} onAdd={() => addLine('otherIncome')} onRemove={(id) => removeLine('otherIncome', id)} />
      </Section>

      {/* Expenses */}
      <Section title="Operating expenses" info="m.expenseRatio" color="amber">
        <Pct label="Expense growth" v={inp.expenseGrowthPct} onChange={(v) => set({ expenseGrowthPct: v })} />
        <LineItems title="Expense line items" info="m.expensePerUnit" items={inp.expenses} ctx={expCtx} onChange={(id, p) => updateLine('expenses', id, p)} onAdd={() => addLine('expenses')} onRemove={(id) => removeLine('expenses', id)} />
      </Section>

      {/* Capital */}
      <Section title="Capital plan & uses" info="c.capex" color="indigo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money label="Purchase price" v={inp.purchasePrice} step={100_000} onChange={(v) => set({ purchasePrice: v })} />
          <Pct label="Acq fee" info="c.acqFee" v={inp.acqFeePct} onChange={(v) => set({ acqFeePct: v })} />
          <Money label="Reserves /unit" info="c.reserves" v={inp.reservesPerUnit} step={50} onChange={(v) => set({ reservesPerUnit: v })} />
        </div>
        <LineItems title="CapEx" info="c.capex" items={inp.capexItems} ctx={incCtx} onChange={(id, p) => updateLine('capexItems', id, p)} onAdd={() => addLine('capexItems')} onRemove={(id) => removeLine('capexItems', id)} />
        <LineItems title="Closing costs" info="c.closingCosts" items={inp.closingItems} ctx={incCtx} onChange={(id, p) => updateLine('closingItems', id, p)} onAdd={() => addLine('closingItems')} onRemove={(id) => removeLine('closingItems', id)} />
      </Section>

      {/* Financing */}
      <Section title="Financing — debt stack" info="f.ltv" color="sky">
        <div className="mb-3 flex rounded-lg border border-slate-300 p-0.5 text-xs font-medium">
          <button onClick={() => set({ financingType: 'new' })} className={`flex-1 rounded-md px-3 py-1.5 ${inp.financingType === 'new' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>New loan (size to LTV)</button>
          <button onClick={() => set({ financingType: 'assumption' })} className={`flex-1 rounded-md px-3 py-1.5 ${inp.financingType === 'assumption' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Loan assumption (from LOI)</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {inp.financingType === 'new' ? (
            <>
              <Pct label="LTV" info="f.ltv" v={inp.ltv} onChange={(v) => set({ ltv: v })} />
              <Plain label="Senior loan (derived)" value={usd(loan, { compact: true })} />
            </>
          ) : (
            <Money label="Assumed loan $" info="f.assumption" v={inp.loanAmount} step={100_000} onChange={(v) => set({ loanAmount: v })} />
          )}
          <Pct label="Interest rate" info="f.interestRate" v={inp.interestRate} onChange={(v) => set({ interestRate: v })} />
          <Num label="IO months" info="f.io" v={inp.ioMonths} step={6} onChange={(v) => set({ ioMonths: v })} />
          <Num label="Amort months" info="f.amort" v={inp.amortMonths} step={12} onChange={(v) => set({ amortMonths: v })} />
          <Num label="Loan term (yrs, balloon)" v={inp.loanTermYears} onChange={(v) => set({ loanTermYears: v })} />
        </div>

        <Toggle label="Supplemental loan" info="f.supplemental" on={inp.suppEnabled} onToggle={(v) => set({ suppEnabled: v })}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Money label="Amount" v={inp.suppAmount} step={50_000} onChange={(v) => set({ suppAmount: v })} />
            <Pct label="Rate" v={inp.suppRate} onChange={(v) => set({ suppRate: v })} />
            <Num label="Fund in year (0=close)" v={inp.suppFundYear} onChange={(v) => set({ suppFundYear: v })} />
            <Num label="Amort months" v={inp.suppAmortMonths} step={12} onChange={(v) => set({ suppAmortMonths: v })} />
          </div>
        </Toggle>

        <Toggle label="Seller financing" info="f.sellerFinancing" on={inp.sellerEnabled} onToggle={(v) => set({ sellerEnabled: v })}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Money label="Note amount" v={inp.sellerAmount} step={50_000} onChange={(v) => set({ sellerAmount: v })} />
            <Pct label="Rate" v={inp.sellerRate} onChange={(v) => set({ sellerRate: v })} />
            <Num label="Amort months" v={inp.sellerAmortMonths} step={12} onChange={(v) => set({ sellerAmortMonths: v })} />
            <Num label="Term (yrs, balloon)" v={inp.sellerTermYears} onChange={(v) => set({ sellerTermYears: v })} />
          </div>
        </Toggle>

        <Toggle label="Refinance during hold" info="f.refi" on={inp.refiEnabled} onToggle={(v) => set({ refiEnabled: v })}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Equity — pref box clearly separate from common box */}
      <Section title="Equity stack & waterfall" info="r.waterfall" color="violet">
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
      <Section title="Exit" info="c.hold" color="rose">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="Hold (years, max 12)" info="c.hold" v={inp.holdYears} onChange={(v) => set({ holdYears: v })} />
          <Pct label="Exit cap" info="m.stabilizedCap" v={inp.exitCapRate} onChange={(v) => set({ exitCapRate: v })} />
          <Pct label="Sale cost %" info="c.exitCosts" v={inp.saleCostPct} onChange={(v) => set({ saleCostPct: v })} />
        </div>
        <LineItems title="Other exit costs" info="c.exitCosts" items={inp.exitItems} ctx={incCtx} onChange={(id, p) => updateLine('exitItems', id, p)} onAdd={() => addLine('exitItems')} onRemove={(id) => removeLine('exitItems', id)} />
      </Section>

      {/* Proforma — debt service split by lien */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 text-base font-bold">Proforma cash flow</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead><tr className="text-slate-500">
              <th className="py-1 text-left font-medium">Year</th>
              {r.years.map((y) => (<th key={y.year} className="py-1 text-right font-medium">Y{y.year}</th>))}
            </tr></thead>
            <tbody className="tabular-nums">
              <Row label="EGI" cells={r.years.map((y) => usd(y.egi, { compact: true }))} />
              <Row label="Opex" cells={r.years.map((y) => usd(y.opex, { compact: true }))} />
              <Row label="NOI" cells={r.years.map((y) => usd(y.noi, { compact: true }))} bold />
              <Row label="DS · 1st lien" cells={r.years.map((y) => usd(y.dsSenior, { compact: true }))} muted />
              {showSupp && <Row label="DS · supplemental" cells={r.years.map((y) => usd(y.dsSupp, { compact: true }))} muted />}
              {showSeller && <Row label="DS · seller note" cells={r.years.map((y) => usd(y.dsSeller, { compact: true }))} muted />}
              {showRefi && <Row label="DS · refi loan" cells={r.years.map((y) => usd(y.dsRefi, { compact: true }))} muted />}
              <Row label="Total debt service" cells={r.years.map((y) => usd(y.debtService, { compact: true }))} />
              <Row label="Cash flow" cells={r.years.map((y) => usd(y.cashFlow, { compact: true }))} bold />
              <Row label="Refi/supp proceeds" cells={r.years.map((y) => (y.financingProceeds ? usd(y.financingProceeds, { compact: true }) : '—'))} muted />
              <Row label="DSCR" cells={r.years.map((y) => y.dscr.toFixed(2))} muted />
            </tbody>
          </table>
        </div>
      </div>

      {/* Waterfall */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-base font-bold">Distributions to investors <InfoTip k="r.waterfall" /></h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead><tr className="text-slate-500">
              <th className="py-1 text-left font-medium">Year</th>
              {r.waterfall.map((w) => (<th key={w.year} className="py-1 text-right font-medium">Y{w.year}</th>))}
            </tr></thead>
            <tbody className="tabular-nums">
              {inp.prefEquityEnabled && <Row label="Pref (current + carry)" cells={r.waterfall.map((w) => usd(w.pref, { compact: true }))} />}
              <Row label="LP" cells={r.waterfall.map((w) => usd(w.lp, { compact: true }))} bold />
              <Row label="GP" cells={r.waterfall.map((w) => usd(w.gp, { compact: true }))} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample investor return */}
      <div className="border-b border-slate-100 p-4">
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

const SECTION_COLOR: Record<string, string> = {
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  indigo: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  sky: 'border-sky-300 bg-sky-50 text-sky-800',
  violet: 'border-violet-300 bg-violet-50 text-violet-800',
  rose: 'border-rose-300 bg-rose-50 text-rose-800',
};

function Section({ title, info, color, children }: { title: string; info?: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 p-4">
      <div className={`mb-3 flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 ${SECTION_COLOR[color]}`}>
        <h3 className="text-base font-bold">{title}</h3>
        {info && <InfoTip k={info} />}
      </div>
      {children}
    </div>
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

function Money({ label, v, onChange, step = 1, info }: { label: string; v: number; onChange: (n: number) => void; step?: number; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>
        <input type="number" value={v} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-300 py-1 pl-5 pr-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
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

function Row({ label, cells, bold, muted }: { label: string; cells: string[]; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={`border-t border-slate-50 ${muted ? 'text-slate-500' : ''}`}>
      <td className={`py-1 text-left ${bold ? 'font-semibold' : ''}`}>{label}</td>
      {cells.map((c, i) => (<td key={i} className={`py-1 text-right ${bold ? 'font-semibold' : ''}`}>{c}</td>))}
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
