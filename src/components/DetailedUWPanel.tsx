'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import {
  defaultDetailedInputs,
  num,
  pct,
  runDetailedUW,
  usd,
  type DetailedUWInputs,
  type MarketDeal,
} from '@/lib/sim';

export function DetailedUWPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf, setStatus, statusOf } = useApp();
  const files = filesOf(deal.id);
  const hasT12 = files.some((f) => f.kind === 'T12');
  const hasRR = files.some((f) => f.kind === 'RentRoll');

  const [inp, setInp] = useState<DetailedUWInputs>(() => defaultDetailedInputs(deal));
  const set = (patch: Partial<DetailedUWInputs>) => setInp((s) => ({ ...s, ...patch }));
  const r = useMemo(() => runDetailedUW(inp), [inp]);

  const ltv = inp.purchasePrice > 0 ? inp.loanAmount / inp.purchasePrice : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Results on top (rediq-style KPI band) */}
      <div className="border-b border-slate-100 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Detailed Underwriting</h2>
          <button
            onClick={() => setInp(defaultDetailedInputs(deal))}
            className="text-xs text-slate-500 underline hover:text-slate-900"
          >
            Reset assumptions
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Purchase price" value={usd(inp.purchasePrice, { compact: true })} big />
          <Kpi label="Levered IRR" value={pct(r.leveredIRR)} tone={r.leveredIRR >= 0.15 ? 'good' : r.leveredIRR >= 0.1 ? 'ok' : 'bad'} big />
          <Kpi label="Equity multiple" value={`${r.equityMultiple.toFixed(2)}x`} big />
          <Kpi label="Avg cash-on-cash" value={pct(r.avgCashOnCash)} big />
          <Kpi label="Unlevered IRR" value={pct(r.unleveredIRR)} />
          <Kpi label="Going-in cap" value={pct(r.goingInCap)} />
          <Kpi label="Yr-1 DSCR" value={r.year1DSCR.toFixed(2)} tone={r.year1DSCR >= 1.25 ? 'good' : 'bad'} />
          <Kpi label="Equity required" value={usd(r.equityRequired, { compact: true })} />
        </div>
      </div>

      {/* Files status */}
      <div className="border-b border-slate-100 p-4">
        <div className="grid grid-cols-2 gap-2">
          <FileStatus ok={hasT12} label="T-12" />
          <FileStatus ok={hasRR} label="Rent roll" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Upload the T-12 + rent roll (on the deal&apos;s Files) and we&apos;ll auto-populate Year-1 + unit mix.
          For now the model starts from your napkin figures — edit any assumption below.
        </p>
      </div>

      {/* Editable assumptions */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Assumptions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Group title="Operations">
            <Money label="Avg rent /mo" v={inp.avgRentMo} onChange={(v) => set({ avgRentMo: v })} />
            <Money label="Other inc /unit/yr" v={inp.otherIncomePerUnitYr} step={50} onChange={(v) => set({ otherIncomePerUnitYr: v })} />
            <Pct label="Vacancy" v={inp.vacancy} onChange={(v) => set({ vacancy: v })} />
            <Money label="Exp /unit/yr" v={inp.expensePerUnitYr} step={100} onChange={(v) => set({ expensePerUnitYr: v })} />
            <Pct label="Rent growth" v={inp.rentGrowthPct} onChange={(v) => set({ rentGrowthPct: v })} />
            <Pct label="Expense growth" v={inp.expenseGrowthPct} onChange={(v) => set({ expenseGrowthPct: v })} />
          </Group>
          <Group title="Financing">
            <Money label="Loan amount" v={inp.loanAmount} step={100_000} onChange={(v) => set({ loanAmount: v })} />
            <Plain label="LTV" value={pct(ltv)} />
            <Pct label="Interest rate" v={inp.interestRate} onChange={(v) => set({ interestRate: v })} />
            <Num label="IO months" v={inp.ioMonths} step={6} onChange={(v) => set({ ioMonths: v })} />
            <Num label="Amort months" v={inp.amortMonths} step={12} onChange={(v) => set({ amortMonths: v })} />
          </Group>
          <Group title="Capital">
            <Money label="Purchase price" v={inp.purchasePrice} step={100_000} onChange={(v) => set({ purchasePrice: v })} />
            <Money label="CapEx budget" v={inp.capexBudget} step={50_000} onChange={(v) => set({ capexBudget: v })} />
            <Pct label="Closing cost" v={inp.closingCostPct} onChange={(v) => set({ closingCostPct: v })} />
            <Pct label="Acq fee" v={inp.acqFeePct} onChange={(v) => set({ acqFeePct: v })} />
            <Money label="Reserves /unit" v={inp.reservesPerUnit} step={50} onChange={(v) => set({ reservesPerUnit: v })} />
          </Group>
          <Group title="Exit">
            <Num label="Hold (years)" v={inp.holdYears} onChange={(v) => set({ holdYears: v })} />
            <Pct label="Exit cap" v={inp.exitCapRate} onChange={(v) => set({ exitCapRate: v })} />
            <Pct label="Sale cost" v={inp.saleCostPct} onChange={(v) => set({ saleCostPct: v })} />
          </Group>
        </div>
      </div>

      {/* Proforma table */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Proforma cash flow</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-medium">Year</th>
                {r.years.map((y) => (
                  <th key={y.year} className="py-1 text-right font-medium">Y{y.year}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <Row label="EGI" cells={r.years.map((y) => usd(y.egi, { compact: true }))} />
              <Row label="Opex" cells={r.years.map((y) => usd(y.opex, { compact: true }))} />
              <Row label="NOI" cells={r.years.map((y) => usd(y.noi, { compact: true }))} bold />
              <Row label="Debt svc" cells={r.years.map((y) => usd(y.debtService, { compact: true }))} />
              <Row label="Cash flow" cells={r.years.map((y) => usd(y.cashFlow, { compact: true }))} bold />
              <Row label="DSCR" cells={r.years.map((y) => y.dscr.toFixed(2))} muted />
            </tbody>
          </table>
        </div>
      </div>

      {/* Sources & uses + exit */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <h4 className="mb-1 text-xs font-semibold text-slate-600">Sources &amp; Uses</h4>
          <Line k="Purchase price" v={usd(inp.purchasePrice)} />
          <Line k="Closing + acq fee" v={usd(inp.purchasePrice * (inp.closingCostPct + inp.acqFeePct))} />
          <Line k="CapEx + reserves" v={usd(inp.capexBudget + inp.reservesPerUnit * inp.units)} />
          <Line k="Total cost" v={usd(r.totalCost)} bold />
          <Line k="Loan" v={usd(inp.loanAmount)} />
          <Line k="Equity required" v={usd(r.equityRequired)} bold />
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <h4 className="mb-1 text-xs font-semibold text-slate-600">Exit (Year {Math.round(inp.holdYears)})</h4>
          <Line k="Forward NOI" v={usd(r.exitNOI)} />
          <Line k={`Sale @ ${pct(inp.exitCapRate)} cap`} v={usd(r.salePrice)} bold />
          <Line k="Sale costs" v={`(${usd(r.saleCosts)})`} />
          <Line k="Loan payoff" v={`(${usd(r.loanPayoff)})`} />
          <Line k="Net sale proceeds" v={usd(r.netSaleProceeds)} bold />
        </div>
      </div>

      {/* Proceed */}
      <div className="border-t border-slate-100 p-4">
        <button
          onClick={() => setStatus(deal.id, 'loi')}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {statusOf(deal.id) === 'detailed' || statusOf(deal.id) === 'napkin' ? 'Proceed to LOI →' : 'Go to LOI →'}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          The returns look workable? Advance to the Letter of Intent to make your offer.
        </p>
      </div>
    </section>
  );
}

// --- small pieces ---

function Kpi({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'good' | 'ok' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'ok' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-semibold ${big ? 'text-lg' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  );
}

function FileStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
      <span>{ok ? '✓' : '!'}</span>
      <span>{label}</span>
      <span className="ml-auto text-xs">{ok ? 'uploaded' : 'needed'}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-600">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Money({ label, v, onChange, step = 1 }: { label: string; v: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>
        <input type="number" value={v} step={step} onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-slate-300 py-1 pl-5 pr-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
      </div>
    </label>
  );
}

function Num({ label, v, onChange, step = 1 }: { label: string; v: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input type="number" value={v} step={step} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
    </label>
  );
}

function Pct({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="relative">
        <input type="number" value={+(v * 100).toFixed(2)} step={0.25} onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full rounded-md border border-slate-300 py-1 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
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

function Row({ label, cells, bold, muted }: { label: string; cells: string[]; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={`border-t border-slate-50 ${muted ? 'text-slate-500' : ''}`}>
      <td className={`py-1 text-left ${bold ? 'font-semibold' : ''}`}>{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`py-1 text-right ${bold ? 'font-semibold' : ''}`}>{c}</td>
      ))}
    </tr>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-slate-100 py-0.5 text-xs ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
