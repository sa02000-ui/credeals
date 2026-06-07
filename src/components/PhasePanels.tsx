'use client';

/**
 * Lifecycle phase scaffolds. Structure is real (derived from the owner's LOI / Contract-to-Close /
 * Asset-Management templates); the wiring (doc generation, detailed-UW engine, live dates) comes
 * phase by phase. Each panel shows what it WILL do so the end-to-end flow is navigable now.
 */

import { useApp } from '@/lib/store';
import { usd, type MarketDeal } from '@/lib/sim';

function PhaseShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{badge}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Checklist({ items }: { items: { label: string; meta?: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 text-[10px] text-slate-300">
            ✓
          </span>
          <span className="text-slate-700">{it.label}</span>
          {it.meta && <span className="ml-auto shrink-0 text-[11px] text-slate-400">{it.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DetailedUWPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf } = useApp();
  const files = filesOf(deal.id);
  const hasT12 = files.some((f) => f.kind === 'T12');
  const hasRR = files.some((f) => f.kind === 'RentRoll');
  return (
    <PhaseShell
      title="Detailed Underwriting"
      badge="scaffold"
      subtitle="Ingest the T-12 and rent roll → a rediq-style read-only analysis + a Synthesis-style proforma (P&L, debt, waterfall, IRR/EM)."
    >
      <div className="mb-3 grid grid-cols-2 gap-2">
        <FileStatus ok={hasT12} label="T-12 (trailing P&L)" />
        <FileStatus ok={hasRR} label="Rent roll" />
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        <p className="font-medium text-slate-700">Coming next (wiring):</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Parse T-12 + rent roll → unit mix, in-place vs market rents, expense detail.</li>
          <li>Results-on-top KPI band (IRR, EMx, DSCR, cap) + editable assumptions below (rediq layout).</li>
          <li>Full proforma + debt + LP/GP waterfall (Synthesis engine), versioned per deal.</li>
          <li>Override any field — even formula-driven — flagged when changed (Synthesis flexibility).</li>
        </ul>
      </div>
      <button
        disabled={!hasT12 || !hasRR}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        title={!hasT12 || !hasRR ? 'Upload T-12 and rent roll first' : ''}
      >
        Generate detailed model
      </button>
    </PhaseShell>
  );
}

function FileStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
      <span>{ok ? '✓' : '!'}</span>
      <span>{label}</span>
      <span className="ml-auto text-xs">{ok ? 'uploaded' : 'needed'}</span>
    </div>
  );
}

export function LOIPanel({ deal }: { deal: MarketDeal }) {
  // Term fields are the real LOI template merge variables (functionality_maps §B).
  const terms = [
    ['Purchase Price', usd(deal.askPrice)],
    ['Earnest Money Deposit', '1% — due 3 days after execution'],
    ['Due Diligence', '30 days'],
    ['Title Insurance', "Seller's expense"],
    ['Escrow Close', '60 days (min)'],
    ['Financing', 'New loan vs. Loan Assumption (template variant)'],
    ['Offer Expiration', '5 business days'],
  ];
  return (
    <PhaseShell
      title="Letter of Intent"
      badge="scaffold"
      subtitle="Generate the LOI from your template (new-loan or loan-assumption variant) and send to the seller/broker."
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {terms.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-slate-50 py-1 text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Exhibit A-1 (DD document request: leases, T-12, rent roll, tax bills, surveys, environmental…) auto-attaches.
        Doc generation + seller-response simulation wire here next.
      </p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Generate LOI</button>
        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Preview Exhibit A-1</button>
      </div>
    </PhaseShell>
  );
}

export function C2CPanel() {
  // Critical-dates tasks from the real Contract-to-Close Gantt (functionality_maps §C).
  const tasks = [
    { label: 'LOI Accepted', meta: 'day 0' },
    { label: 'PSA Executed', meta: '+10d' },
    { label: 'Earnest Money to Title', meta: '+3d' },
    { label: 'Review Title Commitment', meta: '30d' },
    { label: 'Survey', meta: '30d' },
    { label: 'Feasibility / DD period', meta: '31d' },
    { label: 'Debt quotes (×5) → decide lender', meta: '15d ea' },
    { label: 'Loan Commitment (Financing Contingency)', meta: '30d' },
    { label: 'Closing Docs + HUD', meta: '+7d' },
    { label: 'Close / Distribute Funds', meta: '+7d' },
  ];
  return (
    <PhaseShell
      title="Contract to Close"
      badge="scaffold"
      subtitle="A critical-dates project plan from PSA execution to closing — each task with a due date and owner."
    >
      <Checklist items={tasks} />
      <p className="mt-3 text-xs text-slate-500">
        Live dates (driven from PSA date), task owners, the GP-team formation (capital raise / guarantor), and
        recovery branches when a deadline slips wire here next.
      </p>
    </PhaseShell>
  );
}

export function AMPanel() {
  // From the Asset Management End-to-End checklist (functionality_maps §F).
  const takeover = [
    { label: 'Property visit + arrange services' },
    { label: 'PM software set up + rent roll migrated' },
    { label: 'Takeover / management-change letters' },
    { label: 'Utilities, bank account, accounting set up' },
    { label: 'Reconcile rent roll / delinquency / deposits to ledger' },
    { label: 'Lease audit + walk units' },
  ];
  const ongoing = [
    { label: 'Weekly PM call — occupancy, delinquency, work orders, cash', meta: 'weekly' },
    { label: 'Financials by the 10th + owner report + investor update', meta: 'monthly' },
    { label: 'Investor meeting + budget reassess', meta: 'quarterly' },
    { label: 'K-1, tax protest, insurance renewal, cost seg', meta: 'annual' },
  ];
  return (
    <PhaseShell
      title="Asset Management"
      badge="scaffold"
      subtitle="Takeover checklist → the 3–5 year hold: track NOI vs proforma, distributions, and the eventual refi/sale."
    >
      <h3 className="mb-1 text-sm font-semibold">Takeover</h3>
      <Checklist items={takeover} />
      <h3 className="mb-1 mt-4 text-sm font-semibold">Ongoing cadence</h3>
      <Checklist items={ongoing} />
      <p className="mt-3 text-xs text-slate-500">
        Connects to the live AM Portal (massiveam.com) pattern. Scoring vs. the proforma you promised wires here.
      </p>
    </PhaseShell>
  );
}
