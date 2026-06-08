'use client';

import { useMemo, useState } from 'react';
import { usd, type MarketDeal } from '@/lib/sim';

type CloseFrom = 'dd' | 'psa';
type Financing = 'new' | 'assumption';

interface LOIForm {
  entity: string;
  purchasePrice: number;
  emdAmount: number;
  emdDays: number;
  ddDays: number;
  closeDays: number;
  closeFrom: CloseFrom;
  financing: Financing;
  offerExpDays: number;
  titleSellerExpense: boolean;
}

const DD_DOCS = [
  'All tenant leases and rental agreements (physical & digital)',
  "Trailing 2 years' certified operating statements",
  'Current rent roll, tenant ledgers, and accounts-receivable report',
  'Up-to-date trailing-12 income & expense (monthly)',
  'Current property balance sheet',
  'Trailing-12 turnover and lease-concession matrix',
  'Trailing 3 years of RE tax bills and tax-paid receipts',
  'Detail of current staffing and payroll expense',
  'Most recent survey, environmental report, and appraisal',
  'Copies of all service/vendor contracts',
];

function buildLOI(deal: MarketDeal, f: LOIForm): string {
  const closeFromText =
    f.closeFrom === 'dd'
      ? 'following the expiration of the Due Diligence period'
      : 'following the execution of the Purchase and Sale Agreement';
  const financingText =
    f.financing === 'new'
      ? 'Purchaser intends to obtain new financing. This LOI and the resulting PSA are contingent upon Purchaser obtaining a satisfactory loan commitment within the financing-contingency period.'
      : "Purchaser intends to assume the Seller's existing loan, subject to lender approval and assumption terms.";
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `${today}

Re: Letter of Intent — ${deal.name}${deal.address ? `, ${deal.address}` : ''}${deal.city ? `, ${deal.city}, ${deal.state}` : ''}

To the Seller and/or Seller's Broker:

The below non-binding Letter of Intent ("LOI") outlines the terms and conditions under which ${f.entity} and/or assigns ("Purchaser") will enter into a formal Purchase and Sale Agreement ("PSA") for the property described below.

PROPERTY DESCRIPTION
${deal.name}${deal.address ? ` — ${deal.address}` : ''}${deal.city ? `, ${deal.city}, ${deal.state}` : ''}${deal.unitCount ? ` (${deal.unitCount} units)` : ''}.

PURCHASE PRICE & TERMS
Purchase Price to be ${usd(f.purchasePrice)}, payable in cash at closing.

EARNEST MONEY DEPOSIT
${usd(f.emdAmount)} (${((f.emdAmount / Math.max(1, f.purchasePrice)) * 100).toFixed(1)}% of Purchase Price), due ${f.emdDays} days after execution of the PSA, held by the title company and applicable to the Purchase Price at closing.

DUE DILIGENCE
Purchaser shall be granted ${f.ddDays} days of due diligence from the effective date of the PSA, during which Purchaser may terminate for any reason and receive a full refund of the Earnest Money Deposit.

TITLE INSURANCE
${f.titleSellerExpense ? "At Seller's expense, Seller shall deliver an owner's title policy in the amount of the Purchase Price." : "Title insurance at Purchaser's expense."}

ESCROW / CLOSE
Purchaser shall close within ${f.closeDays} days ${closeFromText}.

FINANCING
${financingText}

CONFIDENTIALITY
Both parties agree to keep the terms of this proposal confidential.

OFFER EXPIRATION
This Letter of Intent is non-binding and expires ${f.offerExpDays} business days from the date hereof unless accepted in writing.

Sincerely,
${f.entity}

ACCEPTED AND AGREED TO:
Purchaser: ____________________________     Seller: ____________________________
Date: ________________________               Date: ________________________

EXHIBIT A-1 — DUE DILIGENCE DOCUMENT REQUEST
Seller shall provide Purchaser, within ${f.emdDays} days of execution, the following:
${DD_DOCS.map((d) => `  • ${d}`).join('\n')}
  • Other information as may be requested during Due Diligence.
`;
}

export function LOIPanel({ deal }: { deal: MarketDeal }) {
  const [f, setF] = useState<LOIForm>({
    entity: 'Massive Capital, LLC',
    purchasePrice: deal.askPrice,
    emdAmount: Math.round(deal.askPrice * 0.01),
    emdDays: 3,
    ddDays: 30,
    closeDays: 30,
    closeFrom: 'dd',
    financing: 'new',
    offerExpDays: 5,
    titleSellerExpense: true,
  });
  const set = (patch: Partial<LOIForm>) => setF((s) => ({ ...s, ...patch }));

  const generated = useMemo(() => buildLOI(deal, f), [deal, f]);
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? generated;

  function download() {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOI - ${deal.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-lg font-semibold">Letter of Intent</h2>
        <p className="mt-1 text-sm text-slate-600">
          Answer a few questions (prefilled from the deal). The LOI generates live — then edit it freely before sending.
        </p>
      </div>

      {/* Form */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Terms</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Text label="Purchaser entity" value={f.entity} onChange={(v) => set({ entity: v })} />
          <Money label="Purchase price" v={f.purchasePrice} step={100_000} onChange={(v) => set({ purchasePrice: v })} />
          <Money label="Earnest money" v={f.emdAmount} step={5_000} onChange={(v) => set({ emdAmount: v })} />
          <Num label="EMD due (days after PSA)" v={f.emdDays} onChange={(v) => set({ emdDays: v })} />
          <Num label="Due-diligence days" v={f.ddDays} onChange={(v) => set({ ddDays: v })} />
          <Num label="Closing days" v={f.closeDays} onChange={(v) => set({ closeDays: v })} />
          <Select
            label="Closing days counted from"
            value={f.closeFrom}
            onChange={(v) => set({ closeFrom: v as CloseFrom })}
            options={[
              ['dd', 'DD expiration'],
              ['psa', 'PSA signing'],
            ]}
          />
          <Select
            label="Financing"
            value={f.financing}
            onChange={(v) => set({ financing: v as Financing })}
            options={[
              ['new', 'New loan'],
              ['assumption', 'Loan assumption'],
            ]}
          />
          <Num label="Offer expiration (business days)" v={f.offerExpDays} onChange={(v) => set({ offerExpDays: v })} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          EMD is {((f.emdAmount / Math.max(1, f.purchasePrice)) * 100).toFixed(1)}% of price. Editing a term regenerates the draft (unless you&apos;ve hand-edited below).
        </p>
      </div>

      {/* Generated, editable LOI */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">LOI draft {edited != null && <span className="text-xs font-normal text-amber-600">(hand-edited)</span>}</h3>
          <div className="flex gap-2">
            {edited != null && (
              <button onClick={() => setEdited(null)} className="text-xs text-slate-500 underline hover:text-slate-900">
                Revert to generated
              </button>
            )}
            <button onClick={download} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              Download .txt
            </button>
            <button onClick={() => navigator.clipboard?.writeText(text)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              Copy
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setEdited(e.target.value)}
          spellCheck={false}
          className="h-96 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-slate-900 focus:outline-none"
        />
        <p className="mt-2 text-[11px] text-slate-500">
          Word/PDF export + e-signature + a simulated seller response come next. For now, edit, download, or copy.
        </p>
      </div>
    </section>
  );
}

// --- inputs ---

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none" />
    </label>
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

function Num({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
