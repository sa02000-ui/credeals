'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { downloadDoc, downloadPdf } from '@/lib/export/docExport';
import { LOINegotiationModal } from '@/components/LOINegotiationModal';
import { PSARedlineModal } from '@/components/PSARedlineModal';
import { StageEncounters } from '@/components/StageEncounters';
import { buildLOIScenarios, buildPSA, dealCounterparties, usd, type LOITerms, type MarketDeal, type PSAClause } from '@/lib/sim';

type CloseFrom = 'dd' | 'psa';
type Financing = 'new' | 'assumption';
type TitlePayer = 'seller' | 'buyer' | 'split';
type NonRefundTrigger = 'psa' | 'daysFromPsa' | 'ddExpiration' | 'financingContingency' | 'custom';
type ValueMode = 'amount' | 'pct';

interface LOIForm {
  entity: string;
  purchasePrice: number;
  // earnest money — dual $ / % (amount is source of truth)
  emdAmount: number;
  emdDays: number;
  // non-refundable ("go hard")
  nonRefundMode: ValueMode;
  nonRefundValue: number; // $ when mode=amount, decimal when mode=pct
  nonRefundTrigger: NonRefundTrigger;
  nonRefundDays: number; // for daysFromPsa / custom
  ddDays: number;
  closeDays: number;
  closeFrom: CloseFrom;
  financing: Financing;
  // financing contingency
  finContingencyEnabled: boolean;
  finAppDays: number; // loan application within N days of effective date
  finContingencyDays: number; // N days from DD period for loan approval
  titlePayer: TitlePayer;
  offerExpDays: number;
  // extensions
  extensionsEnabled: boolean;
  extensionCount: number;
  extensionDays: number;
  extensionFeeMode: ValueMode;
  extensionFee: number; // $ or decimal
}

// Full Exhibit A-1 due-diligence document request, faithful to Template-LOI-New Loan.docx.
const DD_DOCS = [
  'All tenant leases and rental agreements (physical onsite & digital)',
  'All existing vendor, service, and personnel contracts (janitorial, HVAC, valet/trash, laundry, landscape, parking-lot maintenance, insurance, termite/pest, phone/data, security, office equipment, fire sprinkler, etc.)',
  'Trailing 2 years certified operating statements, including detail of cost of major repairs',
  'Current rent roll, tenant ledgers, and accounts-receivable report',
  'Up-to-date trailing-12 income and expense (monthly)',
  'Up-to-date trailing-12 accounts receivable (monthly)',
  'Budget forecast for major repairs',
  'Current property balance sheet',
  'Trailing-12-month turnover and lease-concession matrix',
  'Trailing-12-month mechanical contractor expense report with contact information',
  'Trailing 3 years RE tax bills and tax-paid receipts',
  'Detail of current RE tax appeal and contact information of appeal service provider',
  'Detail of current staffing and payroll expense',
  'Inventory of personal property on premises (used to maintain or stored for property)',
  'Inventory of all furniture, appliances, and computer/network equipment on property',
  'Copies of trailing 24 months utility bills',
  'Schedule and description of all current or pending litigation relating to the property',
  'Copies of all required local permits, termite bonds, certificates of occupancy',
  'Copies of all existing structural/roof/mechanical inspector/contractor reports',
  'Details of any neighborhood association membership/requirements',
  'Property website service/hosting provider and login information',
  'Site plan / water & gas shutoff map / unit-type floor plans',
  'Most recent survey',
  'Most recent environmental report',
  'Most recent appraisal',
  'Most recent termite/pest control report',
  'Construction as-built plans, if any',
  'Three years of tax returns – Form 8825',
  'Three years of operating account bank statements',
  'Three years of insurance loss runs, if any',
];

function nonRefundText(deal: MarketDeal, f: LOIForm): string {
  const amt = f.nonRefundMode === 'pct' ? f.purchasePrice * f.nonRefundValue : f.nonRefundValue;
  const amtStr = `${usd(amt)}${f.nonRefundMode === 'pct' ? ` (${(f.nonRefundValue * 100).toFixed(1)}% of Purchase Price)` : ''}`;
  const when: Record<NonRefundTrigger, string> = {
    psa: 'upon execution of the Purchase and Sale Agreement',
    daysFromPsa: `${f.nonRefundDays} days following execution of the Purchase and Sale Agreement`,
    ddExpiration: 'at the expiration of the Due Diligence (feasibility) period, conditioned on clear title and loan approval',
    financingContingency: 'upon expiration of the Financing Contingency Period',
    custom: `on day ${f.nonRefundDays} following the effective date`,
  };
  return `${amtStr} of the Earnest Money Deposit shall become non-refundable ${when[f.nonRefundTrigger]}, except in the event of a Seller default.`;
}

function buildLOI(deal: MarketDeal, f: LOIForm): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const emdPct = ((f.emdAmount / Math.max(1, f.purchasePrice)) * 100).toFixed(1);
  const closeFromText = f.closeFrom === 'dd' ? 'following the expiration of the Due Diligence period' : 'following the execution of the Purchase and Sale Agreement';
  const financingText =
    f.financing === 'new'
      ? 'Purchaser intends to obtain new financing.'
      : "Purchaser intends to assume the Seller's existing loan, subject to lender approval and assumption terms.";
  const finContingency = f.finContingencyEnabled
    ? `Purchaser shall complete loan application and provide required partner information within ${f.finAppDays} days following the Effective Date. Purchaser shall have ${f.finContingencyDays} days from the Due Diligence period (the "Financing Contingency Period") for loan approval; failure to obtain a satisfactory loan commitment within that period entitles Purchaser to terminate and receive a refund of the (then-refundable) Earnest Money Deposit.`
    : 'This offer is not contingent on financing.';
  const titleText =
    f.titlePayer === 'seller'
      ? "At Seller's expense, Seller shall deliver a preliminary title and an owner's title policy in the amount of the Purchase Price."
      : f.titlePayer === 'buyer'
        ? "Title insurance shall be at Purchaser's expense."
        : 'Title insurance costs to be split between Purchaser and Seller as is customary in the county where the Property is located.';
  const extText = f.extensionsEnabled
    ? `Seller shall provide Purchaser ${f.extensionCount} optional ${f.extensionDays}-day closing extension(s) in exchange for Purchaser releasing an additional ${f.extensionFeeMode === 'pct' ? `${(f.extensionFee * 100).toFixed(1)}%` : usd(f.extensionFee)} of Earnest Money (non-refundable, applicable to the Purchase Price) for each extension.`
    : 'No closing extensions are contemplated.';

  return `${today}

Re: Letter of Intent — ${deal.name}${deal.address ? `, ${deal.address}` : ''}${deal.city ? `, ${deal.city}, ${deal.state}` : ''}

The below non-binding Letter of Intent ("LOI") is an outline of the terms and conditions under which ${f.entity} and/or assigns ("Purchaser") will enter a formal Purchase and Sale Agreement ("PSA") for the property described herein.

PROPERTY DESCRIPTION
The purchase price and terms herein include the land, improvements, equipment, furniture, fixtures, and appliances (other than those belonging to the residents). A complete legal description will be furnished for Purchaser's approval prior to the opening of escrow.
${deal.name}${deal.address ? ` — ${deal.address}` : ''}${deal.city ? `, ${deal.city}, ${deal.state}` : ''}${deal.unitCount ? ` (${deal.unitCount} units)` : ''} (collectively the "Property").

PURCHASER
${f.entity}, a limited liability company, and/or assigns.

PURCHASE PRICE & TERMS
Purchase Price to be ${usd(f.purchasePrice)}, payable in cash at closing.

EARNEST MONEY DEPOSIT
${usd(f.emdAmount)} (${emdPct}% of Purchase Price) due ${f.emdDays} days after execution of the PSA and applicable to the Purchase Price. Purchaser may deposit the earnest money in an interest-bearing account with interest accruing to Purchaser.
${nonRefundText(deal, f)}

DUE DILIGENCE
Purchaser shall be granted ${f.ddDays} days following execution of the PSA and full delivery of the documents in Seller's possession outlined in Exhibit A-1, during which Purchaser may terminate for any reason and receive a full refund of the (then-refundable) Earnest Money Deposit.

FULL AGREEMENT
Purchaser shall deliver to Seller a formal PSA and Escrow Instructions upon acceptance of this LOI.

TITLE INSURANCE
${titleText}

ESCROW / CLOSE
Purchaser shall close within ${f.closeDays} days ${closeFromText}.

FINANCING
${financingText}

FINANCING CONTINGENCY
${finContingency}

ADDITIONAL TERMS
${extText} Both parties will pay their brokers as per separate agreements.

CONFIDENTIALITY
Both parties agree to keep all negotiations, terms and conditions confidential.

TERMS
This offer is made on the assumption that the offering memorandum, T-12, and rent roll are true and accurate.

OFFER EXPIRATION
This Letter of Intent is non-binding and will be formalized in a mutually acceptable PSA. Please indicate acceptance by signing below and returning an executed copy within ${f.offerExpDays} business days of the date hereof.

Sincerely,
${f.entity}

ACCEPTED AND AGREED TO:
Purchaser: ____________________________     Seller: ____________________________
Date: ________________________               Date: ________________________

EXHIBIT A-1 — DUE DILIGENCE DOCUMENT REQUEST
Purchaser's performance is conditioned upon Purchaser's approval of the following (Seller to provide within ${f.emdDays} days of written acceptance):
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
    nonRefundMode: 'amount',
    nonRefundValue: Math.round(deal.askPrice * 0.01),
    nonRefundTrigger: 'ddExpiration',
    nonRefundDays: 30,
    ddDays: 30,
    closeDays: 60,
    closeFrom: 'dd',
    financing: 'new',
    finContingencyEnabled: true,
    finAppDays: 21,
    finContingencyDays: 45,
    titlePayer: 'seller',
    offerExpDays: 7,
    extensionsEnabled: true,
    extensionCount: 2,
    extensionDays: 15,
    extensionFeeMode: 'amount',
    extensionFee: Math.round(deal.askPrice * 0.005),
  });
  const set = (patch: Partial<LOIForm>) => setF((s) => ({ ...s, ...patch }));

  // Persist the LOI financing choice so the Detailed UW stage can carry a loan assumption forward.
  const [, setLoiRecord] = useDealLocal<{ financing: Financing; purchasePrice: number }>('loi', deal.id, { financing: 'new', purchasePrice: deal.askPrice });
  useEffect(() => {
    setLoiRecord({ financing: f.financing, purchasePrice: f.purchasePrice });
  }, [f.financing, f.purchasePrice, setLoiRecord]);

  const generated = useMemo(() => buildLOI(deal, f), [deal, f]);
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? generated;

  const { mode, difficulty, game, applyGameOutcome, setStatus, statusOf, addFiles, filesOf, advanceDays, sessionSeed, updateRelationship, updateDealDNA } = useApp();
  const { broker, seller } = dealCounterparties(deal.id, sessionSeed?.value ?? 0);
  const [celebrate, setCelebrate] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [psaClauses, setPsaClauses] = useState<PSAClause[] | null>(null);
  const [, setPsaState] = useDealLocal<{ done: boolean; caught: string[]; missed: string[] }>('psa', deal.id, { done: false, caught: [], missed: [] });
  const executedLoi = filesOf(deal.id).find((x) => x.kind === 'LOI');

  const emdPct = f.emdAmount / Math.max(1, f.purchasePrice);
  const negTerms: LOITerms = { price: f.purchasePrice, emdPct, ddDays: f.ddDays, closeDays: f.closeDays, financingContingency: f.finContingencyEnabled };
  const loiScenarios = useMemo(() => buildLOIScenarios({ market: game.market, difficulty: difficulty ?? 'standard' }), [game.market, difficulty]);

  function onLoiAccepted(finalTerms: LOITerms) {
    set({ purchasePrice: finalTerms.price, emdAmount: Math.round(finalTerms.emdPct * finalTerms.price), ddDays: finalTerms.ddDays, closeDays: finalTerms.closeDays, finContingencyEnabled: finalTerms.financingContingency });
    applyGameOutcome({ dealId: deal.id, pursued: true, repDelta: { broker: 3 }, cashDelta: -Math.round(finalTerms.emdPct * finalTerms.price), cashLabel: `Earnest money — ${deal.name}`, event: { title: `LOI accepted: ${deal.name}`, detail: `Terms agreed at ${usd(finalTerms.price)}.`, lesson: 'LOI accepted — next the seller’s counsel sends the PSA. Read it carefully.' } });
    setNegotiating(false);
    advanceDays(2); // papering the accepted LOI takes a couple of days
    updateRelationship(broker.id, 'closed-clean', deal.id, `LOI accepted on ${deal.name}`);
    updateDealDNA(deal.id, { brokerPersonaId: broker.id, sellerPersonaId: seller.id, brokerRelAtLOI: game.reputation.broker });
    setPsaClauses(buildPSA(difficulty ?? 'standard'));
  }
  function onLoiLost() {
    applyGameOutcome({ dealId: deal.id, repDelta: { broker: -2 }, event: { title: `Lost: ${deal.name}`, detail: 'The seller went another direction.', lesson: 'You can’t win them all — move faster or sharpen your terms next time.' } });
    setNegotiating(false);
    setStatus(deal.id, 'archived');
  }
  function onPsaDone(caught: string[], missed: string[]) {
    setPsaState({ done: true, caught, missed });
    setPsaClauses(null);
    advanceDays(5); // PSA drafting + attorney redline rounds take days
    setStatus(deal.id, 'c2c');
  }

  function onUploadExecuted(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addFiles(deal.id, [{ id: `${deal.id}-loi-${Date.now()}`, name: file.name, kind: 'LOI', sizeBytes: file.size, ts: Date.now() }]);
    e.target.value = '';
  }

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
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">Letter of Intent</h2>
          <InfoTip k="step.loi" />
        </div>
        <p className="mt-1 text-sm text-slate-600">Answer a few questions (prefilled from the deal). The LOI generates live — edit it freely, export to Word/PDF, then mark it accepted to unlock Contract-to-Close.</p>
      </div>

      {/* Form */}
      <div className="border-b border-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold">Terms</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Text label="Purchaser entity" value={f.entity} onChange={(v) => set({ entity: v })} />
          <Money label="Purchase price" v={f.purchasePrice} step={100_000} onChange={(v) => set({ purchasePrice: v })} />

          {/* EMD dual $ / % */}
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="flex items-center gap-1 text-[11px] text-slate-500">Earnest money <InfoTip k="loi.emd" /></span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>
                <input type="number" value={f.emdAmount} step={5000} onChange={(e) => set({ emdAmount: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 py-1 pl-5 pr-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
              </div>
              <span className="text-xs text-slate-400">or</span>
              <div className="relative w-20">
                <input type="number" value={+(emdPct * 100).toFixed(2)} step={0.25} onChange={(e) => set({ emdAmount: Math.round((Number(e.target.value) / 100) * f.purchasePrice) })} className="w-full rounded-md border border-slate-300 py-1 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
                <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>
              </div>
            </div>
          </div>

          <Num label="EMD due (days after PSA)" v={f.emdDays} onChange={(v) => set({ emdDays: v })} />
          <Num label="Due-diligence days" info="loi.dd" v={f.ddDays} onChange={(v) => set({ ddDays: v })} />

          {/* Non-refundable */}
          <div className="sm:col-span-2">
            <span className="flex items-center gap-1 text-[11px] text-slate-500">Earnest money becomes non-refundable <InfoTip k="loi.goHard" /></span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-28">
                {f.nonRefundMode === 'amount' && <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>}
                <input type="number" value={f.nonRefundMode === 'pct' ? +(f.nonRefundValue * 100).toFixed(2) : f.nonRefundValue} step={f.nonRefundMode === 'pct' ? 0.25 : 5000}
                  onChange={(e) => set({ nonRefundValue: f.nonRefundMode === 'pct' ? Number(e.target.value) / 100 : Number(e.target.value) })}
                  className={`w-full rounded-md border border-slate-300 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none ${f.nonRefundMode === 'pct' ? 'pl-2 pr-5' : 'pl-5 pr-2'}`} />
                {f.nonRefundMode === 'pct' && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>}
              </div>
              <select value={f.nonRefundMode} onChange={(e) => set({ nonRefundMode: e.target.value as ValueMode })} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                <option value="amount">$ amount</option>
                <option value="pct">% of price</option>
              </select>
              <select value={f.nonRefundTrigger} onChange={(e) => set({ nonRefundTrigger: e.target.value as NonRefundTrigger })} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                <option value="psa">at PSA execution</option>
                <option value="daysFromPsa">N days from PSA</option>
                <option value="ddExpiration">at DD expiration</option>
                <option value="financingContingency">at financing-contingency expiration</option>
                <option value="custom">custom day</option>
              </select>
              {(f.nonRefundTrigger === 'daysFromPsa' || f.nonRefundTrigger === 'custom') && (
                <div className="w-20"><input type="number" value={f.nonRefundDays} onChange={(e) => set({ nonRefundDays: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" placeholder="days" /></div>
              )}
            </div>
          </div>

          <Num label="Closing days" v={f.closeDays} onChange={(v) => set({ closeDays: v })} />
          <Select label="Closing days counted from" info="loi.closeFrom" value={f.closeFrom} onChange={(v) => set({ closeFrom: v as CloseFrom })} options={[['dd', 'DD expiration'], ['psa', 'PSA signing']]} />
          <Select label="Financing" info="f.newLoan" value={f.financing} onChange={(v) => set({ financing: v as Financing })} options={[['new', 'New loan'], ['assumption', 'Loan assumption']]} />
          <Select label="Title insurance paid by" value={f.titlePayer} onChange={(v) => set({ titlePayer: v as TitlePayer })} options={[['seller', 'Seller'], ['buyer', 'Buyer'], ['split', 'Split (customary)']]} />
          <Num label="Offer expiration (business days)" v={f.offerExpDays} onChange={(v) => set({ offerExpDays: v })} />
        </div>

        {/* Financing contingency */}
        <div className="mt-3 rounded-lg border border-slate-200">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
            <input type="checkbox" checked={f.finContingencyEnabled} onChange={(e) => set({ finContingencyEnabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-700">Financing contingency</span>
            <InfoTip k="loi.financingContingency" />
          </label>
          {f.finContingencyEnabled && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
              <Num label="Loan application within (days of effective date)" v={f.finAppDays} onChange={(v) => set({ finAppDays: v })} />
              <Num label="Financing contingency period (days from DD)" v={f.finContingencyDays} onChange={(v) => set({ finContingencyDays: v })} />
            </div>
          )}
        </div>

        {/* Extensions */}
        <div className="mt-3 rounded-lg border border-slate-200">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
            <input type="checkbox" checked={f.extensionsEnabled} onChange={(e) => set({ extensionsEnabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-700">Closing extensions</span>
            <InfoTip k="loi.extensions" />
          </label>
          {f.extensionsEnabled && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 sm:grid-cols-4">
              <Num label="Number" v={f.extensionCount} onChange={(v) => set({ extensionCount: v })} />
              <Num label="Days each" v={f.extensionDays} onChange={(v) => set({ extensionDays: v })} />
              <Select label="Added EMD as" value={f.extensionFeeMode} onChange={(v) => set({ extensionFeeMode: v as ValueMode })} options={[['amount', '$ amount'], ['pct', '% of price']]} />
              <div>
                <span className="text-[11px] text-slate-500">Added EMD each</span>
                <div className="relative">
                  {f.extensionFeeMode === 'amount' && <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">$</span>}
                  <input type="number" value={f.extensionFeeMode === 'pct' ? +(f.extensionFee * 100).toFixed(2) : f.extensionFee} step={f.extensionFeeMode === 'pct' ? 0.25 : 5000}
                    onChange={(e) => set({ extensionFee: f.extensionFeeMode === 'pct' ? Number(e.target.value) / 100 : Number(e.target.value) })}
                    className={`w-full rounded-md border border-slate-300 py-1 text-sm tabular-nums focus:outline-none ${f.extensionFeeMode === 'pct' ? 'pl-2 pr-5' : 'pl-5 pr-2'}`} />
                  {f.extensionFeeMode === 'pct' && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">%</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game-mode: pre-offer color (competing buyers, seller intel) before the live negotiation */}
      {mode === 'game' && difficulty && loiScenarios.length > 0 && (
        <div className="px-4 pt-4">
          <StageEncounters deal={deal} phase="loi" builtins={loiScenarios} icon="🤝" />
        </div>
      )}

      {/* Game-mode: submit the LOI into a live negotiation with the seller */}
      {mode === 'game' && (
        <div className="border-b border-slate-100 bg-violet-50/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">🎭 Submit &amp; negotiate</h3>
          <p className="mb-2 text-xs text-slate-600">Seller: <b>{seller.name}</b> — {seller.blurb} <span className="text-violet-700">💡 {seller.tells[0]}</span></p>
          <button onClick={() => setNegotiating(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Submit LOI &amp; negotiate at {usd(f.purchasePrice, { compact: true })} →</button>
          <p className="mt-1 text-[11px] text-slate-500">You'll go back and forth over a few days — the seller counters specific terms; hold your line or concede what costs you least. A disciplined hold can win.</p>
        </div>
      )}

      {/* Generated, editable LOI */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">LOI draft {edited != null && <span className="text-xs font-normal text-amber-600">(hand-edited)</span>}</h3>
          <div className="flex gap-2">
            {edited != null && <button onClick={() => setEdited(null)} className="text-xs text-slate-500 underline hover:text-slate-900">Revert to generated</button>}
            <button onClick={() => downloadDoc(text, `LOI - ${deal.name}`)} className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100">⬇ Word</button>
            <button onClick={() => downloadPdf(text, `LOI - ${deal.name}`)} className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">⬇ PDF</button>
            <button onClick={download} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">.txt</button>
            <button onClick={() => navigator.clipboard?.writeText(text)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">Copy</button>
          </div>
        </div>
        <textarea value={text} onChange={(e) => setEdited(e.target.value)} spellCheck={false} className="h-96 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-slate-900 focus:outline-none" />

        {/* Real mode: mark accepted manually to unlock C2C */}
        {mode === 'real' && (
          <div className="mt-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-emerald-800">LOI accepted by the seller?</div>
                <div className="text-xs text-emerald-700">Mark it accepted to unlock Contract-to-Close.</div>
              </div>
              <button onClick={() => setCelebrate(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">🤝 LOI Accepted</button>
            </div>
          </div>
        )}
      </div>

      {negotiating && (
        <LOINegotiationModal dealName={deal.name} askPrice={deal.askPrice} seller={seller} initialTerms={negTerms} onAccepted={onLoiAccepted} onLost={onLoiLost} onClose={() => setNegotiating(false)} />
      )}
      {psaClauses && <PSARedlineModal dealName={deal.name} clauses={psaClauses} onDone={onPsaDone} onClose={() => setPsaClauses(null)} />}

      {celebrate && (
        <CelebrationModal
          deal={deal}
          executedName={executedLoi?.name ?? null}
          onUploadExecuted={onUploadExecuted}
          onContinue={() => { setStatus(deal.id, 'c2c'); setCelebrate(false); }}
          onClose={() => setCelebrate(false)}
          alreadyC2C={statusOf(deal.id) === 'c2c' || statusOf(deal.id) === 'am'}
        />
      )}
    </section>
  );
}

function CelebrationModal({
  deal,
  executedName,
  onUploadExecuted,
  onContinue,
  onClose,
}: {
  deal: MarketDeal;
  executedName: string | null;
  onUploadExecuted: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onClose: () => void;
  alreadyC2C: boolean;
}) {
  const [choice, setChoice] = useState<null | 'asdrafted' | 'changed'>(null);
  const confetti = ['🎉', '🎊', '✨', '🥂', '💸', '🏢', '🔑', '📈'];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* confetti */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.concat(confetti).map((c, i) => (
            <span key={i} className="absolute animate-bounce text-xl" style={{ left: `${(i * 6.5) % 100}%`, top: `${(i % 4) * 18}%`, animationDelay: `${(i % 6) * 0.12}s`, animationDuration: '1.6s' }}>{c}</span>
          ))}
        </div>
        <div className="relative">
          <div className="text-5xl">🎉</div>
          <h3 className="mt-2 text-xl font-bold text-slate-900">LOI Accepted!</h3>
          <p className="mt-1 text-sm text-slate-600">Congratulations — <b>{deal.name}</b> is under LOI. Time to open Contract-to-Close.</p>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
            <div className="text-xs font-semibold text-slate-700">Was the system-drafted LOI accepted, or were there changes?</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setChoice('asdrafted')} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${choice === 'asdrafted' ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>Accepted as drafted</button>
              <button onClick={() => setChoice('changed')} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${choice === 'changed' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>There were changes</button>
            </div>
            {choice === 'changed' && (
              <div className="mt-2">
                {executedName ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700"><span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium">LOI</span><span className="truncate">{executedName}</span><label className="ml-auto cursor-pointer text-sky-600 underline">replace<input type="file" className="hidden" onChange={onUploadExecuted} /></label></div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">+ Upload the signed/executed LOI<input type="file" className="hidden" onChange={onUploadExecuted} /></label>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Not yet</button>
            <button disabled={choice == null || (choice === 'changed' && !executedName)} onClick={onContinue} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">Continue to Contract-to-Close →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- inputs ---

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none" />
    </label>
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

function Num({ label, v, onChange, info }: { label: string; v: number; onChange: (n: number) => void; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none" />
    </label>
  );
}

function Select({ label, value, onChange, options, info }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; info?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{label}{info && <InfoTip k={info} />}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none">
        {options.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
      </select>
    </label>
  );
}
