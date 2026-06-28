'use client';

/**
 * GP Roles & Responsibilities matrix — the team-formation deliverable. Splits GP economics across the
 * six functions a sponsorship team must cover (sourcing, risk money, balance sheet, sponsor consultant,
 * fund manager/IR, asset management), each carrying an editable weight with a suggested range. A
 * member's share of GP = Σ (their % of each bucket × that bucket's weight); their share of the whole
 * deal = GP% × GP share. Optionally links the GP-profit pool to the Detailed-UW base scenario.
 *
 * Feeds the Org Chart (members + deal shares become the Class-B ownership) — see DealTeamPanel.
 */

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { MoneyInput } from '@/components/MoneyInput';
import {
  ACQ_FEE_LADDER,
  GP_BUCKETS,
  STANDARD_FEES,
  acqFeeBracket,
  defaultDetailedInputs,
  defaultGPTeam,
  pct,
  runDetailedUW,
  runGPTeam,
  usd,
  type GPKeyNumbers,
  type GPTeamState,
  type MarketDeal,
} from '@/lib/sim';

const mid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

interface UWNumbers { dealSize: number; gpProfit: number; acqFee: number; amFees: number; ok: boolean }
/** Pull the headline economics from the Detailed-UW base scenario (robust to legacy/missing state). */
function useUWlink(deal: MarketDeal): UWNumbers {
  const [scenarios] = useDealLocal<{ id: string; name: string; inputs: unknown }[]>('uw-scenarios-v2', deal.id, []);
  return useMemo(() => {
    const base = (scenarios[0]?.inputs as ReturnType<typeof defaultDetailedInputs> | undefined) ?? defaultDetailedInputs(deal);
    try {
      const r = runDetailedUW(base);
      const amFees = r.years.reduce((a, y) => a + y.egi * STANDARD_FEES.assetManagement, 0);
      // The pool the matrix splits = all GP economics: profit/promote + co-invest profit + acq fee + AM fees.
      const gpProfit = Math.max(0, Math.round(r.gpProfit + amFees));
      return { dealSize: base.purchasePrice, gpProfit, acqFee: Math.round(r.acqFee), amFees: Math.round(amFees), ok: scenarios.length > 0 };
    } catch {
      return { dealSize: deal.askPrice, gpProfit: 0, acqFee: 0, amFees: 0, ok: false };
    }
  }, [scenarios, deal]);
}

export function GPTeamPanel({ deal }: { deal: MarketDeal }) {
  const { peopleOf } = useApp();
  const people = peopleOf(deal.id);
  const [state, setState] = useDealLocal<GPTeamState>('gpteam', deal.id, defaultGPTeam('You (Sponsor)'));
  const link = useUWlink(deal);
  const kn = state.keyNumbers ?? {};
  // Effective key numbers: the UW value unless the user has overridden the field here.
  const dealSize = kn.dealSize ?? link.dealSize;
  const pool = kn.gpProfit ?? link.gpProfit; // total GP profit pool the matrix splits
  const acqFee = kn.acqFee ?? link.acqFee;
  const amFees = kn.amFees ?? link.amFees;
  const bracket = acqFeeBracket(dealSize);
  const setKey = (field: keyof GPKeyNumbers, v: number) => setState((s) => ({ ...s, keyNumbers: { ...s.keyNumbers, [field]: v } }));
  const resetKey = (field: keyof GPKeyNumbers) => setState((s) => { const next: GPKeyNumbers = { ...s.keyNumbers }; delete next[field]; return { ...s, keyNumbers: next }; });

  const result = useMemo(
    () => runGPTeam({ ...state, totalGPProfit: pool }),
    [state, pool],
  );

  const weightSumOff = Math.abs(result.weightSum - 1) > 0.001;
  const underfilled = GP_BUCKETS.filter((b) => Math.abs(result.bucketFill[b.id] - 1) > 0.001);

  // ── mutations ──
  const setAlloc = (memberId: string, bucketId: string, pctVal: number) =>
    setState((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === memberId ? { ...m, alloc: { ...m.alloc, [bucketId]: clamp01(pctVal / 100) } } : m)),
    }));
  const setWeight = (bucketId: string, pctVal: number) =>
    setState((s) => ({ ...s, weights: { ...s.weights, [bucketId]: clamp01(pctVal / 100) } }));
  const addMember = (name: string, entity?: string) =>
    setState((s) => ({ ...s, members: [...s.members, { id: mid(), name, entity, alloc: Object.fromEntries(GP_BUCKETS.map((b) => [b.id, 0])) }] }));
  const renameMember = (id: string, name: string) => setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) }));
  const removeMember = (id: string) => setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));

  const onPeople = people.filter((p) => !state.members.some((m) => m.name === p.name));
  const [newName, setNewName] = useState('');

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">GP Roles &amp; Splits</h2>
          <InfoTip
            title="GP Roles & Responsibilities"
            what="A GP team has to cover six jobs. Each job carries a weight (its share of the General Partner's profit). Inside each job, the partners who do it split 100%. Your share of GP = the sum of (your % of each job × that job's weight). Your share of the whole deal = the GP/LP split × your GP share."
            app="Agree this BEFORE you sign — it decides who gets paid what, and it feeds your lender org chart and capital-raise deck. The weights start at the workbook midpoints; tune them inside the suggested ranges."
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">Who does what on the GP, and how the General Partner economics split between them.</p>
      </div>

      <div className="p-4">
        {/* GP/LP split + acq-fee bracket */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">GP / LP split <InfoTip title="GP / LP split" what="How profit divides between the General Partners (the sponsors who run the deal) and the Limited Partners (the passive investors who fund it). 30/70 is a common starting point — 30% of profit to the GP, 70% to the LPs who put up most of the cash." app="This split sizes the GP profit pool that the roles matrix below divides among your partners." /></div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} value={+(state.gpPct * 100).toFixed(1)} onChange={(e) => setState((s) => ({ ...s, gpPct: clamp01(Number(e.target.value) / 100) }))} className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none" />
              <span className="text-sm text-slate-500">% to GP</span>
              <span className="ml-auto text-xs text-slate-400">{pct(1 - state.gpPct, 0)} to LPs</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">Acquisition-fee bracket <InfoTip title="Acquisition fee" what="A one-time fee the GP earns at closing for sourcing and executing the acquisition, sized as a % of purchase price. Smaller deals justify a higher % because the work is similar but the base is smaller." /></div>
            <div className="text-sm tabular-nums text-slate-800">{pct(bracket.pct, 1)} · {usd(dealSize * bracket.pct)}<span className="ml-1 text-[11px] text-slate-400">on {usd(dealSize, { compact: true })}</span></div>
          </div>
        </div>

        {/* Key deal numbers — linked to the Detailed UW, editable here (owner #1, #9) */}
        <div className="mt-3">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">
            Key deal numbers <InfoTip title="Key deal numbers" what="The headline economics that drive the split: deal size, total GP profit (the pool), the acquisition fee, and asset-management fees over the life of the deal." app="These pull live from your Detailed UW. Edit any of them to override (the box turns amber and the link breaks); press ↺ to re-link to the UW." />
            <span className="font-normal text-slate-400">— from Detailed UW; edit to override, ↺ to re-link</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KeyCard label="Deal size" value={dealSize} overridden={kn.dealSize != null} onSet={(v) => setKey('dealSize', v)} onReset={() => resetKey('dealSize')} ok={link.ok} />
            <KeyCard label="Total GP profit (pool)" value={pool} overridden={kn.gpProfit != null} onSet={(v) => setKey('gpProfit', v)} onReset={() => resetKey('gpProfit')} ok={link.ok} />
            <KeyCard label="Acquisition fee" value={acqFee} overridden={kn.acqFee != null} onSet={(v) => setKey('acqFee', v)} onReset={() => resetKey('acqFee')} ok={link.ok} />
            <KeyCard label="AM fees (life of deal)" value={amFees} overridden={kn.amFees != null} onSet={(v) => setKey('amFees', v)} onReset={() => resetKey('amFees')} ok={link.ok} />
          </div>
        </div>

        {/* Validation */}
        {(weightSumOff || underfilled.length > 0) && (
          <div className="mt-3 space-y-1">
            {weightSumOff && <Banner tone="amber">Bucket weights sum to {pct(result.weightSum, 0)} — they should total 100%.</Banner>}
            {underfilled.length > 0 && (
              <Banner tone="amber">
                Not fully allocated: {underfilled.map((b) => `${b.short} (${pct(result.bucketFill[b.id], 0)})`).join(', ')} — the partners on each job should split to 100%.
              </Banner>
            )}
          </div>
        )}

        {/* Matrix */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="px-2 py-1 text-left font-medium">Partner</th>
                {GP_BUCKETS.map((b) => (
                  <th key={b.id} className="px-1 py-1 text-center font-medium">
                    <div className="flex items-center justify-center gap-0.5">{b.short}<InfoTip title={b.label} what={b.blurb} app={b.flag} /></div>
                    <div className="mt-0.5 flex items-center justify-center gap-0.5">
                      <input type="number" min={0} max={100} value={+(((state.weights[b.id] ?? 0) * 100).toFixed(1))} onChange={(e) => setWeight(b.id, Number(e.target.value))} className={`w-11 rounded border px-1 py-0.5 text-center text-[11px] tabular-nums focus:outline-none ${weightSumOff ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} title={`Weight — suggested ${pct(b.rangeLo, 0)}–${pct(b.rangeHi, 0)}`} />
                      <span className="text-[9px] text-slate-400">wt</span>
                    </div>
                    <div className="text-[9px] font-normal text-slate-300">{pct(b.rangeLo, 0)}–{pct(b.rangeHi, 0)}</div>
                  </th>
                ))}
                <th className="px-2 py-1 text-right font-medium">GP share</th>
                <th className="px-2 py-1 text-right font-medium">Deal share</th>
                <th className="px-2 py-1 text-right font-medium">$ profit</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {result.members.map(({ member, gpShare, dealShare, profit }) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <input value={member.name} onChange={(e) => renameMember(member.id, e.target.value)} className="w-32 rounded border border-transparent px-1 py-0.5 text-sm font-medium text-slate-800 hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
                  </td>
                  {GP_BUCKETS.map((b) => (
                    <td key={b.id} className="px-1 py-1.5 text-center">
                      <input type="number" min={0} max={100} value={+(((member.alloc[b.id] ?? 0) * 100).toFixed(1))} onChange={(e) => setAlloc(member.id, b.id, Number(e.target.value))} className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center text-xs tabular-nums focus:border-slate-400 focus:outline-none" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pct(gpShare, 1)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800">{pct(dealShare, 1)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{usd(profit)}</td>
                  <td className="px-1 py-1.5 text-center">{result.members.length > 1 && <button onClick={() => removeMember(member.id)} className="text-slate-300 hover:text-red-500" title="Remove">✕</button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 text-xs font-medium text-slate-500">
                <td className="px-2 py-1.5">Allocated</td>
                {GP_BUCKETS.map((b) => {
                  const fill = result.bucketFill[b.id];
                  const off = Math.abs(fill - 1) > 0.001;
                  return <td key={b.id} className={`px-1 py-1.5 text-center tabular-nums ${off ? 'rounded bg-red-100 font-bold text-red-700' : 'text-emerald-600'}`}>{pct(fill, 0)}</td>;
                })}
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(result.gpShareSum, 0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(state.gpPct * result.gpShareSum, 0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{usd(pool * result.gpShareSum)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* GP economics summary — life of deal (owner #2) */}
        <div className="mt-4 rounded-lg border border-slate-200 p-3 sm:max-w-md">
          <div className="mb-1 text-xs font-semibold text-slate-600">GP economics — life of deal</div>
          <table className="w-full text-sm">
            <tbody className="tabular-nums">
              <SumRow k="Deal size (purchase price)" v={usd(dealSize)} />
              <SumRow k="Total GP profit (the pool below)" v={usd(pool)} bold />
              <SumRow k="• Acquisition fee (at closing)" v={usd(acqFee)} muted />
              <SumRow k="• Asset-management fees (life)" v={usd(amFees)} muted />
              <SumRow k="Allocated to partners" v={usd(pool * result.gpShareSum)} />
              <SumRow k="Unallocated" v={usd(pool * (1 - result.gpShareSum))} warn={result.gpShareSum < 0.999} />
            </tbody>
          </table>
        </div>

        {/* Add partner */}
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
          <label className="block flex-1"><span className="text-[11px] text-slate-500">Add partner</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { addMember(newName.trim()); setNewName(''); } }} placeholder="Partner name" className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" /></label>
          <button onClick={() => { if (newName.trim()) { addMember(newName.trim()); setNewName(''); } }} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">Add</button>
          {onPeople.length > 0 && (
            <div className="w-full">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">From people on this deal:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {onPeople.map((p) => (<button key={p.id} onClick={() => addMember(p.name)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100">+ {p.name}</button>))}
              </div>
            </div>
          )}
        </div>

        {/* Fee schedule reference */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-600">Standard fee schedule <span className="font-normal text-slate-400">— acquisition fee scales down as deals get bigger</span></div>
          <div className="flex flex-wrap gap-1.5">
            {ACQ_FEE_LADDER.map((b) => {
              const here = b.label === bracket.label;
              return <span key={b.label} className={`rounded-md px-2 py-1 text-xs tabular-nums ${here ? 'bg-emerald-600 text-white font-semibold' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{b.label}: {pct(b.pct, 0)}</span>;
            })}
            <span className="rounded-md bg-white px-2 py-1 text-xs tabular-nums text-slate-600 ring-1 ring-slate-200">AM: {pct(STANDARD_FEES.assetManagement, 0)}/yr</span>
            <span className="rounded-md bg-white px-2 py-1 text-xs tabular-nums text-slate-600 ring-1 ring-slate-200">Refi: {pct(STANDARD_FEES.refinance, 0)}</span>
            <span className="rounded-md bg-white px-2 py-1 text-xs tabular-nums text-slate-600 ring-1 ring-slate-200">Disposition: {pct(STANDARD_FEES.disposition, 0)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function KeyCard({ label, value, overridden, onSet, onReset, ok }: { label: string; value: number; overridden: boolean; onSet: (n: number) => void; onReset: () => void; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${overridden ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        <span className="truncate">{label}</span>
        {overridden ? (
          <button onClick={onReset} className="shrink-0 font-semibold text-amber-700 hover:underline" title="Reset to the Detailed UW value (re-link)">↺ reset</button>
        ) : (
          <span className="shrink-0 text-emerald-500" title="Linked to Detailed UW">🔗</span>
        )}
      </div>
      <MoneyInput value={value} onChange={onSet} ariaLabel={label} className={`mt-0.5 w-full rounded border px-1.5 py-1 text-right text-sm font-semibold tabular-nums focus:outline-none ${overridden ? 'border-amber-300 bg-white' : 'border-slate-200'}`} />
      {!ok && !overridden && <div className="mt-0.5 text-[9px] text-amber-600">run Detailed UW to populate</div>}
    </div>
  );
}

function SumRow({ k, v, bold, muted, warn }: { k: string; v: string; bold?: boolean; muted?: boolean; warn?: boolean }) {
  return (
    <tr className="border-t border-slate-50">
      <td className={`py-1 pr-2 text-left ${bold ? 'font-semibold text-slate-800' : muted ? 'pl-2 text-slate-400' : 'text-slate-600'}`}>{k}</td>
      <td className={`py-1 text-right ${bold ? 'font-bold text-slate-900' : warn ? 'font-semibold text-amber-600' : 'text-slate-700'}`}>{v}</td>
    </tr>
  );
}

function Banner({ tone, children }: { tone: 'amber' | 'emerald'; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return <div className={`rounded-lg border px-3 py-1.5 text-xs ${cls}`}>{children}</div>;
}

function clamp01(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
