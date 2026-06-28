'use client';

/**
 * Org Chart — the lender-facing ownership structure, built once the GP team is formed. Mirrors the
 * real template: the Property is owned 100% by an Ownership Entity (Holding LLC) whose members are
 * the passive Class A investors (LPs) and the Class B members (the GP entities), and which is run by
 * a non-member Manager Entity (Manager LLC).
 *
 * Ownership % is capital-based (membership interest) — what lenders care about — and is separate from
 * the GP profit split in module 1. Class B members + their co-invest are seeded from the GP Roles
 * matrix; total equity + GP/LP co-invest are pulled from the Detailed-UW base scenario.
 */

import { useMemo } from 'react';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { MoneyInput } from '@/components/MoneyInput';
import {
  defaultDetailedInputs,
  defaultGPTeam,
  pct,
  runDetailedUW,
  runGPTeam,
  usd,
  type GPTeamState,
  type MarketDeal,
} from '@/lib/sim';

interface ClassAInvestor { id: string; name: string; amount: number }
/** A node in a custom org sub-structure (recursive): an entity or person, optional capital + note
 *  (role / share class), with its own owners beneath it. Powers owner items 7 & 8. */
interface OrgNode { id: string; name: string; note?: string; amount?: number; children?: OrgNode[] }
interface OrgChartState {
  ownershipEntity: string;
  managerEntity: string;
  managerNames: string;
  /** capital co-invest per GP member id ($) */
  gpCoinvest: Record<string, number>;
  classA: ClassAInvestor[];
  /** override total equity (else from UW) */
  totalEquityOverride?: number;
  /** extra entities / layers (e.g. a pref-equity group bringing money via its own entity + share class) — #7 */
  customGroups?: OrgNode[];
  /** sub-owners / sub-structure under each Class B (GP) member, keyed by GP member id — #8 */
  classBSub?: Record<string, OrgNode[]>;
}

const aid = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const nid = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DISCLOSURE = 0.2; // lenders flag any member at ≥20% (≥10% for foreign persons)

export function OrgChartPanel({ deal }: { deal: MarketDeal }) {
  const [gp] = useDealLocal<GPTeamState>('gpteam', deal.id, defaultGPTeam('You (Sponsor)'));
  const [uwScenarios] = useDealLocal<{ id: string; name: string; inputs: unknown }[]>('uw-scenarios-v2', deal.id, []);
  const [state, setState] = useDealLocal<OrgChartState>('orgchart', deal.id, {
    ownershipEntity: `${deal.name} Holding LLC`,
    managerEntity: `${deal.name} Manager LLC`,
    managerNames: gp.members[0]?.name ?? 'Sponsor',
    gpCoinvest: {},
    classA: [],
  });

  // Equity from UW (robust to missing/legacy state).
  const uw = useMemo(() => {
    const base = (uwScenarios[0]?.inputs as ReturnType<typeof defaultDetailedInputs> | undefined) ?? defaultDetailedInputs(deal);
    try {
      const r = runDetailedUW(base);
      return { totalEquity: Math.max(0, Math.round(r.equityRequired)), gpEquity: Math.max(0, Math.round(r.gpEquity)), lpEquity: Math.max(0, Math.round(r.lpEquity)), ok: uwScenarios.length > 0 };
    } catch {
      return { totalEquity: 0, gpEquity: 0, lpEquity: 0, ok: false };
    }
  }, [uwScenarios, deal]);

  const gpResult = useMemo(() => runGPTeam(gp), [gp]);
  const totalEquity = state.totalEquityOverride ?? uw.totalEquity;

  // Class B = GP members, each with a capital co-invest. Default-seed proportional to GP profit share.
  const classB = gpResult.members.map((m) => {
    const seeded = gpResult.gpShareSum > 0 ? (uw.gpEquity * m.gpShare) / gpResult.gpShareSum : 0;
    const amount = state.gpCoinvest[m.member.id] ?? Math.round(seeded);
    return { id: m.member.id, name: m.member.entity || m.member.name, amount };
  });

  const classBTotal = classB.reduce((s, m) => s + m.amount, 0);
  const classATotal = state.classA.reduce((s, a) => s + a.amount, 0);
  const raised = classATotal + classBTotal;
  const ownPct = (amt: number) => (totalEquity > 0 ? amt / totalEquity : 0);
  const fundedPct = totalEquity > 0 ? raised / totalEquity : 0;

  const flagged = [
    ...state.classA.map((a) => ({ name: a.name, p: ownPct(a.amount) })),
    ...classB.map((b) => ({ name: b.name, p: ownPct(b.amount) })),
  ].filter((x) => x.p >= DISCLOSURE);

  // mutations
  const addA = () => setState((s) => ({ ...s, classA: [...s.classA, { id: aid(), name: 'New investor', amount: 0 }] }));
  const setA = (id: string, patch: Partial<ClassAInvestor>) => setState((s) => ({ ...s, classA: s.classA.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const delA = (id: string) => setState((s) => ({ ...s, classA: s.classA.filter((a) => a.id !== id) }));
  const setCoinvest = (memberId: string, amount: number) => setState((s) => ({ ...s, gpCoinvest: { ...s.gpCoinvest, [memberId]: amount } }));
  const setCustomGroups = (groups: OrgNode[]) => setState((s) => ({ ...s, customGroups: groups }));
  const setClassBSub = (memberId: string, nodes: OrgNode[]) => setState((s) => ({ ...s, classBSub: { ...s.classBSub, [memberId]: nodes } }));

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">Org Chart</h2>
          <InfoTip
            title="Ownership org chart"
            what="The legal structure lenders require: the property is owned by a single Ownership Entity (a Holding LLC) whose members are the passive Class A investors (LPs) and the Class B members (the GP entities). A separate Manager Entity runs it as a non-member manager. Ownership % here is capital-based — who put up what — which is different from the GP profit split."
            app="Class B members and their co-invest seed from your GP Roles matrix; total equity comes from your Detailed UW. Lenders flag any member owning 20% or more (10% for foreign persons)."
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">The entity structure for your lender — who owns what, and who manages it.</p>
      </div>

      <div className="p-4">
        {/* Entity names + equity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Ownership entity" hint="owns 100% of the property">
            <input value={state.ownershipEntity} onChange={(e) => setState((s) => ({ ...s, ownershipEntity: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none" />
          </Field>
          <Field label="Manager entity" hint="non-member manager">
            <input value={state.managerEntity} onChange={(e) => setState((s) => ({ ...s, managerEntity: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none" />
          </Field>
          <Field label="Total equity" hint={uw.ok && state.totalEquityOverride == null ? 'from Detailed UW' : 'manual'}>
            <MoneyInput value={totalEquity} onChange={(v) => setState((s) => ({ ...s, totalEquityOverride: v }))} ariaLabel="Total equity" className="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none" />
          </Field>
        </div>

        {/* Funded progress */}
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Equity allocated</span>
            <span className={`tabular-nums ${Math.abs(fundedPct - 1) < 0.005 ? 'text-emerald-600' : 'text-slate-500'}`}>{usd(raised)} / {usd(totalEquity)} · {pct(fundedPct, 0)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${fundedPct > 1.001 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, fundedPct * 100)}%` }} /></div>
        </div>

        {flagged.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            ⚑ Lender disclosure — at/above 20%: {flagged.map((f) => `${f.name} (${pct(f.p, 0)})`).join(', ')}
          </div>
        )}

        {/* The chart */}
        <div className="mt-4 flex flex-col items-center">
          <Box tone="slate" title="The Property" sub={`${deal.name} · ${deal.city}, ${deal.state}`} />
          <Connector />
          <Box tone="indigo" title={state.ownershipEntity} sub="Ownership Entity (Holding LLC) · owns 100% of the Property" />

          {/* Manager is the NON-MEMBER manager of the Holding LLC — a side arm, not an owner. */}
          <div className="mt-1 w-full max-w-md rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-center">
            <div className="text-[11px] text-violet-700"><b>Managed by:</b> {state.managerEntity} <span className="text-violet-500">· non-member manager</span></div>
            <input value={state.managerNames} onChange={(e) => setState((s) => ({ ...s, managerNames: e.target.value }))} className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-0.5 text-center text-[11px] focus:outline-none" placeholder="Manager(s) names" />
          </div>
          <Connector />
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Members of {state.ownershipEntity}</div>

          {/* Members: Class A + Class B are the members (owners) of the Holding LLC */}
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
            {/* Class A — LPs */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-sky-800">Class A members <InfoTip title="Class A members" what="The passive investors — your limited partners (LPs). They contribute capital and share in profit per the operating agreement, but do not manage the asset." /> <span className="ml-auto font-normal text-sky-600">{pct(ownPct(classATotal), 0)} · {usd(classATotal, { compact: true })}</span></div>
              <p className="mb-2 text-[11px] text-sky-700/70">Passive investors (LPs)</p>
              <div className="space-y-1.5">
                {state.classA.length === 0 && <p className="text-[11px] text-slate-400">No LPs yet — add the investors you raise from.</p>}
                {state.classA.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 ring-1 ring-sky-100">
                    <input value={a.name} onChange={(e) => setA(a.id, { name: e.target.value })} className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-xs hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
                    <MoneyInput value={a.amount} onChange={(v) => setA(a.id, { amount: v })} ariaLabel={`${a.name} amount`} className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none" />
                    <span className="w-12 text-right text-[11px] tabular-nums text-slate-500">{pct(ownPct(a.amount), 1)}</span>
                    <button onClick={() => delA(a.id)} className="text-slate-300 hover:text-red-500" title="Remove">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addA} className="mt-2 rounded-md border border-dashed border-sky-300 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">+ Add investor</button>
            </div>

            {/* Class B — GP */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-800">Class B members <InfoTip title="Class B members" what="The GP entities — the sponsorship team's LLCs. They manage the deal and typically co-invest some capital. Their profit comes mostly from the GP split (see GP Roles & Splits), but they also hold a capital ownership % here." /> <span className="ml-auto font-normal text-emerald-600">{pct(ownPct(classBTotal), 0)} · {usd(classBTotal, { compact: true })}</span></div>
              <p className="mb-2 text-[11px] text-emerald-700/70">GP entities (co-invest) — seeded from GP Roles</p>
              <div className="space-y-1.5">
                {classB.map((b) => {
                  const sub = state.classBSub?.[b.id] ?? [];
                  return (
                    <div key={b.id} className="rounded-md bg-white px-2 py-1.5 ring-1 ring-emerald-100">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate px-1 text-xs text-slate-700">{b.name}</span>
                        <MoneyInput value={b.amount} onChange={(v) => setCoinvest(b.id, v)} ariaLabel={`${b.name} co-invest`} className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none" />
                        <span className="w-12 text-right text-[11px] tabular-nums text-slate-500">{pct(ownPct(b.amount), 1)}</span>
                      </div>
                      {/* #8 — this GP entity's own owners / sub-structure */}
                      {sub.length > 0 && (
                        <div className="mt-1 ml-1 border-l-2 border-emerald-100 pl-1">
                          {sub.map((n) => (
                            <OrgNodeEditor key={n.id} node={n} depth={1}
                              onChange={(nc) => setClassBSub(b.id, sub.map((x) => (x.id === n.id ? nc : x)))}
                              onRemove={() => setClassBSub(b.id, sub.filter((x) => x.id !== n.id))} />
                          ))}
                        </div>
                      )}
                      <button onClick={() => setClassBSub(b.id, [...sub, { id: nid(), name: 'New owner / member' }])} className="mt-0.5 text-[10px] text-emerald-700 hover:underline">+ add owner / sub-entity</button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-emerald-700/70">Entity names come from GP Roles &amp; Splits; add the owners under each entity above.</p>
            </div>
          </div>
        </div>

        {/* Custom entities & layers (owner #7) */}
        <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/30 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-violet-800">Additional entities &amp; layers <InfoTip title="Custom entities / layers" what="Add structure beyond the standard Class A / Class B — for example a preferred-equity group that brings money through its own entity holding a separate class of shares, with its own owners beneath it. Each entity can nest owners to any depth." /></div>
          <p className="mb-2 text-[11px] text-violet-700/70">For a pref-equity entity, a JV partner, a fund-of-funds, or any group that owns through its own structure / share class.</p>
          {(state.customGroups ?? []).map((g) => (
            <OrgNodeEditor key={g.id} node={g} depth={0}
              onChange={(nc) => setCustomGroups((state.customGroups ?? []).map((x) => (x.id === g.id ? nc : x)))}
              onRemove={() => setCustomGroups((state.customGroups ?? []).filter((x) => x.id !== g.id))} />
          ))}
          <button onClick={() => setCustomGroups([...(state.customGroups ?? []), { id: nid(), name: 'New entity / group', note: 'e.g. Pref Equity LLC · Class C shares' }])} className="mt-1 rounded-md border border-dashed border-violet-300 px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50">+ Add entity / layer</button>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
          *No person or entity owning a 20% or greater (or 10% or greater for a foreign person/entity) direct or indirect interest in {state.ownershipEntity}, or that directly or indirectly controls the borrower, is omitted from this chart. Ownership % is capital-based membership interest and is illustrative only — confirm the final structure with your attorney and lender.
        </p>
      </div>
    </section>
  );
}

/** Recursive entity/owner editor — name + capital + role/share-class note + nested owners (#7, #8). */
function OrgNodeEditor({ node, depth, onChange, onRemove }: { node: OrgNode; depth: number; onChange: (n: OrgNode) => void; onRemove: () => void }) {
  const children = node.children ?? [];
  return (
    <div className={`rounded-md border border-slate-200 bg-white p-1.5 ${depth > 0 ? 'mt-1' : 'mb-1'}`}>
      <div className="flex items-center gap-1.5">
        <input value={node.name} onChange={(e) => onChange({ ...node, name: e.target.value })} placeholder="Entity / person" className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-xs font-medium text-slate-700 hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
        <MoneyInput value={node.amount ?? 0} onChange={(v) => onChange({ ...node, amount: v })} ariaLabel={`${node.name} capital`} className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none" />
        <button onClick={() => onChange({ ...node, children: [...children, { id: nid(), name: 'New owner' }] })} className="shrink-0 text-[10px] text-sky-600 hover:underline" title="Add owner beneath this entity">+ sub</button>
        <button onClick={onRemove} className="shrink-0 text-slate-300 hover:text-red-500" title="Remove">✕</button>
      </div>
      <input value={node.note ?? ''} onChange={(e) => onChange({ ...node, note: e.target.value })} placeholder="role / entity type / share class (e.g. Texas LLC · Class C)" className="mt-1 w-full rounded border border-slate-100 px-1 py-0.5 text-[10px] text-slate-500 focus:border-slate-300 focus:outline-none" />
      {children.length > 0 && (
        <div className="mt-1 ml-1 border-l-2 border-slate-100 pl-1">
          {children.map((c) => (
            <OrgNodeEditor key={c.id} node={c} depth={depth + 1}
              onChange={(nc) => onChange({ ...node, children: children.map((x) => (x.id === c.id ? nc : x)) })}
              onRemove={() => onChange({ ...node, children: children.filter((x) => x.id !== c.id) })} />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600"><span>{label}</span>{hint && <span className="font-normal text-slate-400">{hint}</span>}</div>
      {children}
    </div>
  );
}

function Box({ tone, title, sub }: { tone: 'slate' | 'indigo'; title: string; sub: string }) {
  const cls = tone === 'slate' ? 'border-slate-300 bg-slate-100 text-slate-800' : 'border-indigo-300 bg-indigo-50 text-indigo-900';
  return (
    <div className={`w-full max-w-md rounded-lg border px-3 py-2 text-center ${cls}`}>
      <div className="text-sm font-bold">{title}</div>
      <div className="text-[11px] opacity-70">{sub}</div>
    </div>
  );
}

function Connector() {
  return <div className="h-4 w-px bg-slate-300" />;
}
