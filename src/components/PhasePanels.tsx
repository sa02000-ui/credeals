'use client';

/**
 * Contract-to-Close and Asset-Management phase panels.
 * - C2C: signed-PSA upload, a PSA-date-driven critical-dates plan with a prominent Critical Path,
 *   editable per-task Start/Days/Lead (from the deal's people)/%, and a per-task comment. Workstreams
 *   (Title, Debt, Insurance, Capital Raise, DD, Legal, Main) roll into a master plan. Keeps the
 *   game-mode capital-raise mini-game.
 * - AM: a collapsible one-time Takeover card + recurring reminders (editable dates, assignees,
 *   custom reminders, auto-reschedule) + quarterly performance logging.
 */

import { Fragment, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { C2CDeck } from '@/components/C2CDeck';
import { AMPhase } from '@/components/AMPhase';
import { usd, type MarketDeal } from '@/lib/sim';

function PhaseShell({ title, subtitle, info, children }: { title: string; subtitle: string; info?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {info && <InfoTip k={info} />}
        </div>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d;
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** whole-day difference between two ISO dates (b − a) */
function diffDays(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso + 'T00:00:00').getTime() - new Date(aIso + 'T00:00:00').getTime()) / 86400000);
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// =====================================================================================
//  CONTRACT TO CLOSE
// =====================================================================================

type Workstream = 'Main' | 'Title & Survey' | 'Debt' | 'Insurance' | 'Capital Raise' | 'Due Diligence' | 'Legal';

const WORKSTREAMS: { id: Workstream; color: string }[] = [
  { id: 'Main', color: 'bg-slate-700' },
  { id: 'Title & Survey', color: 'bg-amber-600' },
  { id: 'Debt', color: 'bg-indigo-600' },
  { id: 'Insurance', color: 'bg-teal-600' },
  { id: 'Capital Raise', color: 'bg-violet-600' },
  { id: 'Due Diligence', color: 'bg-rose-600' },
  { id: 'Legal', color: 'bg-sky-700' },
];

interface TaskDef {
  id: string;
  ws: Workstream;
  label: string;
  lead: string;
  offset: number;
  duration: number;
  critical?: boolean;
}

// Critical-dates engine derived from the real Contract-to-Close tracker (functionality_maps §C).
const C2C_TASKS: TaskDef[] = [
  { id: 'psa', ws: 'Main', label: 'Signed PSA executed', lead: 'Sponsor', offset: 0, duration: 0, critical: true },
  { id: 'emd', ws: 'Main', label: 'Earnest money to title', lead: 'Sponsor', offset: 0, duration: 3, critical: true },
  { id: 'access', ws: 'Main', label: 'Temporary access agreement', lead: 'Sponsor', offset: 0, duration: 5 },
  { id: 'closingdocs', ws: 'Main', label: 'Closing docs + HUD settlement statement', lead: 'Title', offset: 53, duration: 7 },
  { id: 'close', ws: 'Main', label: 'Close / distribute funds', lead: 'All', offset: 60, duration: 0, critical: true },

  { id: 'title-order', ws: 'Title & Survey', label: 'Order title commitment', lead: 'Title', offset: 1, duration: 0 },
  { id: 'title-review', ws: 'Title & Survey', label: 'Title commitment received & reviewed', lead: 'Legal', offset: 1, duration: 30, critical: true },
  { id: 'survey', ws: 'Title & Survey', label: 'Order + review ALTA survey', lead: 'Surveyor', offset: 1, duration: 30 },
  { id: 'title-obj', ws: 'Title & Survey', label: 'Title/survey objections + cures', lead: 'Legal', offset: 31, duration: 7 },

  { id: 'debt-quotes', ws: 'Debt', label: 'Request 5 debt quotes', lead: 'Sponsor', offset: 1, duration: 15 },
  { id: 'debt-decide', ws: 'Debt', label: 'Decide lender', lead: 'Sponsor', offset: 16, duration: 2 },
  { id: 'debt-docs', ws: 'Debt', label: 'Provide docs to lender', lead: 'Sponsor', offset: 18, duration: 15 },
  { id: 'appraisal', ws: 'Debt', label: 'Appraisal ordered + delivered', lead: 'Lender', offset: 18, duration: 21 },
  { id: 'loan-commit', ws: 'Debt', label: 'Loan commitment / financing contingency', lead: 'Lender', offset: 1, duration: 45, critical: true },
  { id: 'rate-lock', ws: 'Debt', label: 'Rate lock', lead: 'Sponsor', offset: 47, duration: 3 },

  { id: 'ins-quotes', ws: 'Insurance', label: 'Request insurance quotes', lead: 'Broker', offset: 5, duration: 14 },
  { id: 'ins-bind', ws: 'Insurance', label: 'Bind insurance (effective at close)', lead: 'Broker', offset: 50, duration: 5, critical: true },

  { id: 'cap-su', ws: 'Capital Raise', label: 'Finalize sources & uses', lead: 'Sponsor', offset: 0, duration: 5 },
  { id: 'cap-package', ws: 'Capital Raise', label: 'Investor package + webinar', lead: 'Sponsor', offset: 5, duration: 10 },
  { id: 'cap-soft', ws: 'Capital Raise', label: 'Collect soft commitments', lead: 'Sponsor', offset: 5, duration: 25 },
  { id: 'cap-funds', ws: 'Capital Raise', label: 'Call + wire investor funds', lead: 'Sponsor', offset: 50, duration: 8, critical: true },

  { id: 'dd-inspect', ws: 'Due Diligence', label: 'Physical inspections + unit walk', lead: 'DD team', offset: 1, duration: 21 },
  { id: 'dd-lease', ws: 'Due Diligence', label: 'Lease audit', lead: 'DD team', offset: 1, duration: 21 },
  { id: 'dd-enviro', ws: 'Due Diligence', label: 'Environmental (Phase I)', lead: 'Consultant', offset: 1, duration: 20 },
  { id: 'dd-expire', ws: 'Due Diligence', label: 'DD expiration / EMD goes hard', lead: 'Sponsor', offset: 0, duration: 30, critical: true },

  { id: 'legal-psa', ws: 'Legal', label: 'PSA legal review', lead: 'Legal', offset: 0, duration: 5 },
  { id: 'legal-entity', ws: 'Legal', label: 'Form acquisition entity + operating agreement', lead: 'Legal', offset: 0, duration: 12 },
  { id: 'legal-closing', ws: 'Legal', label: 'Review closing documents', lead: 'Legal', offset: 50, duration: 10 },
];

interface TaskOverride {
  done?: boolean;
  pct?: number;
  lead?: string;
  comment?: string;
  offset?: number;
  duration?: number;
}
interface C2CState {
  startDate: string;
  overrides: Record<string, TaskOverride>;
}

export function C2CPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf, addFiles, peopleOf, mode, setStatus, statusOf } = useApp();
  const files = filesOf(deal.id);
  const psa = files.find((f) => f.kind === 'PSA');
  const people = peopleOf(deal.id);
  const closed = statusOf(deal.id) === 'am';

  const [state, setState] = useDealLocal<C2CState>('c2c', deal.id, { startDate: new Date().toISOString().slice(0, 10), overrides: {} });
  const [filter, setFilter] = useState<Workstream | 'All'>('All');
  const [openComment, setOpenComment] = useState<string | null>(null);

  const ov = (id: string): TaskOverride => state.overrides[id] ?? {};
  const setOv = (id: string, patch: Partial<TaskOverride>) =>
    setState((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...ov(id), ...patch } } }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = useMemo(() => {
    return C2C_TASKS.map((t) => {
      const o = state.overrides[t.id] ?? {};
      const offset = o.offset ?? t.offset;
      const duration = o.duration ?? t.duration;
      const start = addDays(state.startDate, offset);
      const due = addDays(state.startDate, offset + duration);
      const overdue = !o.done && due < today;
      const dueSoon = !o.done && !overdue && (due.getTime() - today.getTime()) / 86400000 <= 7;
      const lead = o.lead ?? t.lead;
      return { t, offset, duration, start, due, o, overdue, dueSoon, lead };
    });
  }, [state, today]);

  const visible = rows.filter((r) => filter === 'All' || r.t.ws === filter);
  const critical = rows.filter((r) => r.t.critical).sort((a, b) => a.due.getTime() - b.due.getTime());
  const doneCount = rows.filter((r) => r.o.done).length;
  const overdueCount = rows.filter((r) => r.overdue).length;
  const progress = Math.round((doneCount / rows.length) * 100);

  const leadOptions = (def: TaskDef): string[] => Array.from(new Set(['Unassigned', ...people.map((p) => p.name), def.lead]));

  function onPickPsa(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    addFiles(deal.id, [{ id: `${deal.id}-psa-${Date.now()}`, name: f.name, kind: 'PSA', sizeBytes: f.size, ts: Date.now() }]);
    e.target.value = '';
  }

  return (
    <PhaseShell title="Contract to Close" info="step.c2c" subtitle="Upload the signed PSA, anchor the critical-dates calendar, and drive every workstream to the closing table.">
      {/* Game-mode: the live decision deck leads (the planner below is reference) */}
      {mode === 'game' && (
        <div className="mb-4">
          <C2CDeck deal={deal} />
          <p className="mt-2 text-[11px] text-slate-400">The critical-dates planner below is your reference; the decisions above drive the close.</p>
        </div>
      )}

      {/* PSA + start date */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">Signed PSA <InfoTip k="c2c.psa" /></div>
          {psa ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">PSA</span>
              <span className="truncate text-slate-700">{psa.name}</span>
              <label className="ml-auto cursor-pointer text-xs text-sky-600 underline">replace<input type="file" className="hidden" onChange={onPickPsa} /></label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-medium text-slate-500 hover:bg-slate-50">+ Upload signed PSA<input type="file" className="hidden" onChange={onPickPsa} /></label>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">PSA execution date <InfoTip k="c2c.criticalDates" /></div>
          <input type="date" value={state.startDate} onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none" />
          <p className="mt-1 text-[11px] text-slate-500">Every task date is computed from this date (override Start/Days per task below).</p>
        </div>
      </div>

      {/* Critical Path */}
      <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-sm font-bold text-red-700">🚩 Critical Path</span>
          <InfoTip k="c2c.criticalDates" />
          <span className="ml-auto text-xs text-slate-500">{doneCount}/{rows.length} tasks done{overdueCount > 0 && <span className="font-semibold text-red-600"> · {overdueCount} overdue</span>}</span>
        </div>
        <ul className="space-y-1">
          {critical.map(({ t, due, o, overdue, dueSoon, lead }) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={!!o.done} onChange={(e) => setOv(t.id, { done: e.target.checked, pct: e.target.checked ? 100 : o.pct })} className="h-4 w-4 rounded border-slate-300" />
              <span className={o.done ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}>{t.label}</span>
              <span className="text-[11px] text-slate-400">· {lead}</span>
              <span className={`ml-auto text-xs tabular-nums ${o.done ? 'text-emerald-600' : overdue ? 'font-semibold text-red-600' : dueSoon ? 'font-semibold text-amber-600' : 'text-slate-600'}`}>{o.done ? '✓ done' : fmtDate(due)}{overdue && !o.done ? ' ⚠' : ''}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Master plan progress + filter */}
      <div className="mt-4 rounded-lg border border-slate-200 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Master project plan</span>
          <span className="text-slate-500">{progress}% complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip label="All" active={filter === 'All'} onClick={() => setFilter('All')} />
          {WORKSTREAMS.map((w) => (<FilterChip key={w.id} label={w.id} active={filter === w.id} dot={w.color} onClick={() => setFilter(w.id)} />))}
        </div>
      </div>

      {/* Task table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium">✓</th>
              <th className="px-2 py-1 text-left font-medium">Task</th>
              <th className="px-2 py-1 text-left font-medium">Workstream</th>
              <th className="px-2 py-1 text-left font-medium">Lead</th>
              <th className="px-2 py-1 text-right font-medium">Start (date or days from PSA)</th>
              <th className="px-2 py-1 text-right font-medium">Days</th>
              <th className="px-2 py-1 text-right font-medium">Due</th>
              <th className="px-2 py-1 text-right font-medium">%</th>
              <th className="px-2 py-1 text-center font-medium">💬</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ t, offset, duration, start, due, o, overdue, dueSoon, lead }) => {
              const ws = WORKSTREAMS.find((w) => w.id === t.ws)!;
              return (
                <Fragment key={t.id}>
                  <tr className="border-t border-slate-50">
                    <td className="px-2 py-1.5"><input type="checkbox" checked={!!o.done} onChange={(e) => setOv(t.id, { done: e.target.checked, pct: e.target.checked ? 100 : o.pct })} className="h-4 w-4 rounded border-slate-300" /></td>
                    <td className="px-2 py-1.5">
                      <span className={o.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.label}</span>
                      {t.critical && <span className="ml-1.5 rounded bg-red-100 px-1 text-[9px] font-semibold text-red-700">critical</span>}
                    </td>
                    <td className="px-2 py-1.5"><span className="inline-flex items-center gap-1 text-xs text-slate-600"><span className={`h-2 w-2 rounded-full ${ws.color}`} />{t.ws}</span></td>
                    <td className="px-2 py-1.5">
                      <select value={lead} onChange={(e) => setOv(t.id, { lead: e.target.value })} className="max-w-[120px] rounded border border-slate-200 px-1 py-0.5 text-xs focus:outline-none">
                        {leadOptions(t).map((n) => (<option key={n} value={n}>{n}</option>))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {/* Start: pick a calendar date OR type days-from-PSA — they stay in sync */}
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="date"
                          value={toISO(start)}
                          onChange={(e) => e.target.value && setOv(t.id, { offset: diffDays(state.startDate, e.target.value) })}
                          className="rounded border border-slate-200 px-1 py-0.5 text-xs tabular-nums focus:outline-none"
                          title="Start date"
                        />
                        <input
                          type="number"
                          value={offset}
                          onChange={(e) => setOv(t.id, { offset: Number(e.target.value) })}
                          className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none"
                          title="Days from PSA execution"
                        />
                        <span className="text-[9px] text-slate-400">d</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right"><input type="number" value={duration} onChange={(e) => setOv(t.id, { duration: Number(e.target.value) })} className="w-14 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none" /></td>
                    <td className={`px-2 py-1.5 text-right text-xs tabular-nums ${overdue ? 'font-semibold text-red-600' : dueSoon ? 'font-semibold text-amber-600' : 'text-slate-600'}`}>{fmtDate(due)}{overdue && !o.done ? ' ⚠' : ''}</td>
                    <td className="px-2 py-1.5 text-right"><input type="number" min={0} max={100} value={o.pct ?? 0} onChange={(e) => setOv(t.id, { pct: Number(e.target.value), done: Number(e.target.value) >= 100 })} className="w-14 rounded border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none" /></td>
                    <td className="px-2 py-1.5 text-center"><button onClick={() => setOpenComment(openComment === t.id ? null : t.id)} className={`text-sm ${o.comment ? 'text-sky-600' : 'text-slate-300 hover:text-sky-600'}`} title="Comment">💬</button></td>
                  </tr>
                  {openComment === t.id && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={8} className="px-2 py-2">
                        <textarea value={o.comment ?? ''} onChange={(e) => setOv(t.id, { comment: e.target.value })} placeholder="Notes / status update for this task…" className="h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none" />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {people.length === 0 && <p className="mt-2 text-[11px] text-slate-400">Tip: add partners/teammates in “👥 People &amp; access” above to assign them as task leads.</p>}

      {/* Advance to Asset Management. In game mode the decision deck above closes the deal; in Live
          mode there's no deck, so this is how you move a closed deal into AM. */}
      {mode !== 'game' && (
        <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
          {closed ? (
            <div className="text-sm font-semibold text-emerald-800">✅ Closed — this deal is in Asset Management. Open the <b>AM</b> tab above to operate it.</div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-800">Closed and funded?</div>
                <div className="text-xs text-emerald-700">
                  Once you’ve closed and taken title, move the deal into Asset Management.
                  {!state.overrides['close']?.done && <span className="text-amber-700"> (You haven’t checked off “Close / distribute funds” yet — that’s fine, you can still proceed.)</span>}
                </div>
              </div>
              <button
                onClick={() => setStatus(deal.id, 'am')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                ✅ Mark closed → Asset Management
              </button>
            </div>
          )}
        </div>
      )}
    </PhaseShell>
  );
}

function FilterChip({ label, active, onClick, dot }: { label: string; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}{label}
    </button>
  );
}

// =====================================================================================
//  ASSET MANAGEMENT
// =====================================================================================

type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'annual';
const CADENCE_DAYS: Record<Cadence, number> = { weekly: 7, monthly: 30, quarterly: 91, annual: 365 };

interface Reminder {
  id: string;
  label: string;
  cadence: Cadence;
  info?: string;
  nextDue: string;
  lastDone?: string;
  assignee?: string;
}
interface QuarterLog { id: string; period: string; occupancy: number; noi: number; distribution: number; notes: string }
interface AMState { takeover: Record<string, boolean>; takeoverCollapsed: boolean; reminders: Reminder[]; quarters: QuarterLog[]; seeded: boolean }

const TAKEOVER = [
  'Property visit + arrange services',
  'PM software set up + rent roll migrated',
  'Takeover / management-change letters sent',
  'Utilities, bank account, accounting set up',
  'Reconcile rent roll / delinquency / deposits to ledger',
  'Lease audit + walk all units',
  'Certificate of occupancy / licenses transferred',
  'Insurance effective + lender notified',
];

function seedReminders(): Reminder[] {
  const today = new Date();
  const iso = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  return [
    { id: 'r-pmcall', label: 'Weekly PM call (occupancy, delinquency, work orders, cash)', cadence: 'weekly', info: 'am.occupancy', nextDue: iso(3) },
    { id: 'r-fin', label: 'Monthly financials by the 10th', cadence: 'monthly', nextDue: iso(10) },
    { id: 'r-owner', label: 'Monthly owner report + investor update', cadence: 'monthly', info: 'am.distribution', nextDue: iso(12) },
    { id: 'r-invmtg', label: 'Quarterly investor meeting', cadence: 'quarterly', nextDue: iso(45) },
    { id: 'r-budget', label: 'Quarterly budget reassessment', cadence: 'quarterly', nextDue: iso(60) },
    { id: 'r-tax', label: 'Property-tax protest', cadence: 'annual', info: 'am.taxProtest', nextDue: iso(120) },
    { id: 'r-ins', label: 'Insurance renewal — compare carriers', cadence: 'annual', info: 'am.insurance', nextDue: iso(150) },
    { id: 'r-k1', label: 'Issue investor K-1s', cadence: 'annual', info: 'am.k1', nextDue: iso(75) },
    { id: 'r-costseg', label: 'Cost-segregation study', cadence: 'annual', info: 'am.costSeg', nextDue: iso(90) },
    { id: 'r-entity', label: 'Entity / registered-agent renewal', cadence: 'annual', nextDue: iso(200) },
  ];
}

export function AMPanel({ deal }: { deal: MarketDeal }) {
  const { peopleOf, mode } = useApp();
  const people = peopleOf(deal.id);
  const [state, setState] = useDealLocal<AMState>('am', deal.id, { takeover: {}, takeoverCollapsed: false, reminders: [], quarters: [], seeded: false });
  const reminders = state.seeded ? state.reminders : seedReminders();
  const [tab, setTab] = useState<'reminders' | 'quarterly'>('reminders');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function mutateReminders(fn: (list: Reminder[]) => Reminder[]) {
    setState((s) => ({ ...s, seeded: true, reminders: fn(s.seeded ? s.reminders : seedReminders()) }));
  }
  function completeReminder(id: string) {
    mutateReminders((list) => list.map((r) => {
      if (r.id !== id) return r;
      const next = new Date(); next.setDate(next.getDate() + CADENCE_DAYS[r.cadence]);
      return { ...r, lastDone: new Date().toISOString().slice(0, 10), nextDue: next.toISOString().slice(0, 10) };
    }));
  }
  const updateReminder = (id: string, patch: Partial<Reminder>) => mutateReminders((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addReminder = (label: string, cadence: Cadence) => mutateReminders((list) => [...list, { id: `r${Date.now()}`, label, cadence, nextDue: new Date().toISOString().slice(0, 10) }]);
  const removeReminder = (id: string) => mutateReminders((list) => list.filter((r) => r.id !== id));

  const takeoverDone = TAKEOVER.filter((l) => state.takeover[l]).length;
  const takeoverComplete = takeoverDone === TAKEOVER.length;
  const amPeople = people.filter((p) => p.phases.length === 0 || p.phases.includes('am'));

  const sortedReminders = [...reminders].sort((a, b) => a.nextDue.localeCompare(b.nextDue));

  return (
    <PhaseShell title="Asset Management" info="step.am" subtitle="Operate the hold: occupancy & NOI vs. proforma, distributions, recurring obligations, and quarterly reporting.">
      {/* One-time takeover (collapsible) */}
      <div className={`mb-4 rounded-lg border-2 ${takeoverComplete ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
        <button onClick={() => setState((s) => ({ ...s, takeoverCollapsed: !s.takeoverCollapsed }))} className="flex w-full items-center gap-2 px-3 py-2 text-left">
          <span className="text-sm font-bold text-slate-800">{takeoverComplete ? '✅' : '🔑'} Property takeover</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{takeoverDone}/{TAKEOVER.length}</span>
          <span className="text-[11px] text-slate-500">one-time, at closing</span>
          <span className="ml-auto text-xs text-slate-400">{state.takeoverCollapsed ? '▸ show' : '▾ hide'}</span>
        </button>
        {!state.takeoverCollapsed && (
          <div className="space-y-1.5 border-t border-slate-100 p-3">
            {TAKEOVER.map((label) => {
              const on = !!state.takeover[label];
              return (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={on} onChange={(e) => setState((s) => ({ ...s, takeover: { ...s.takeover, [label]: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  <span className={on ? 'text-slate-400 line-through' : 'text-slate-700'}>{label}</span>
                </label>
              );
            })}
            {takeoverComplete && <p className="pt-1 text-xs text-emerald-700">Takeover complete — collapse this and focus on ongoing operations below.</p>}
          </div>
        )}
      </div>

      {amPeople.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-600">On asset management:</span>
          {amPeople.map((p) => (<span key={p.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{p.name}{p.access === 'view' ? ' (view)' : ''}</span>))}
        </div>
      )}

      {mode === 'game' && <div className="mb-4"><AMPhase deal={deal} /></div>}

      <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {([['reminders', 'Reminders & tasks'], ['quarterly', 'Quarterly performance']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>

      {tab === 'reminders' && (
        <div>
          <p className="mb-2 text-xs text-slate-500">Recurring obligations — set dates, assign an owner, complete to auto-schedule the next. Annual items (tax protest, insurance compare, K-1, cost seg) are the easiest to miss.</p>
          <div className="space-y-1.5">
            {sortedReminders.map((r) => {
              const due = new Date(r.nextDue + 'T00:00:00');
              const overdue = due < today;
              const soon = !overdue && (due.getTime() - today.getTime()) / 86400000 <= 14;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cadenceColor(r.cadence)}`}>{r.cadence}</span>
                  <span className="text-slate-700">{r.label}</span>
                  {r.info && <InfoTip k={r.info} />}
                  <div className="ml-auto flex items-center gap-2">
                    <input type="date" value={r.nextDue} onChange={(e) => updateReminder(r.id, { nextDue: e.target.value })} className={`rounded border px-1.5 py-0.5 text-xs tabular-nums focus:outline-none ${overdue ? 'border-red-300 text-red-600' : soon ? 'border-amber-300 text-amber-600' : 'border-slate-200 text-slate-600'}`} />
                    <select value={r.assignee ?? ''} onChange={(e) => updateReminder(r.id, { assignee: e.target.value || undefined })} className="max-w-[110px] rounded border border-slate-200 px-1 py-0.5 text-xs focus:outline-none">
                      <option value="">Unassigned</option>
                      {people.map((p) => (<option key={p.id} value={p.name}>{p.name}</option>))}
                    </select>
                    <button onClick={() => completeReminder(r.id)} className="rounded-md border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Done</button>
                    <button onClick={() => removeReminder(r.id)} className="text-slate-300 hover:text-red-500" title="Remove">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
          <AddReminder onAdd={addReminder} />
        </div>
      )}

      {tab === 'quarterly' && <QuarterlyLog state={state} setState={setState} />}
    </PhaseShell>
  );
}

function AddReminder({ onAdd }: { onAdd: (label: string, cadence: Cadence) => void }) {
  const [label, setLabel] = useState('');
  const [cadence, setCadence] = useState<Cadence>('quarterly');
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
      <label className="block flex-1"><span className="text-[11px] text-slate-500">New reminder</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Re-shop landscaping contract" className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" /></label>
      <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
        {(['weekly', 'monthly', 'quarterly', 'annual'] as Cadence[]).map((c) => (<option key={c} value={c}>{c}</option>))}
      </select>
      <button onClick={() => { if (label.trim()) { onAdd(label.trim(), cadence); setLabel(''); } }} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">Add</button>
    </div>
  );
}

function cadenceColor(c: Cadence): string {
  return c === 'weekly' ? 'bg-sky-100 text-sky-700' : c === 'monthly' ? 'bg-indigo-100 text-indigo-700' : c === 'quarterly' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700';
}

function QuarterlyLog({ state, setState }: { state: AMState; setState: (v: AMState | ((p: AMState) => AMState)) => void }) {
  const [form, setForm] = useState<Omit<QuarterLog, 'id'>>({ period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, occupancy: 0.93, noi: 0, distribution: 0, notes: '' });
  function add() {
    setState((s) => ({ ...s, quarters: [{ id: `q${Date.now()}`, ...form }, ...s.quarters] }));
    setForm((f) => ({ ...f, noi: 0, distribution: 0, notes: '' }));
  }
  return (
    <div>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">Log this quarter <InfoTip k="am.occupancy" /></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block"><span className="text-[11px] text-slate-500">Period</span><input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">Occupancy %</span><input type="number" value={+(form.occupancy * 100).toFixed(1)} onChange={(e) => setForm({ ...form, occupancy: Number(e.target.value) / 100 })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">NOI ($)</span><input type="number" value={form.noi} onChange={(e) => setForm({ ...form, noi: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">Distribution ($)</span><input type="number" value={form.distribution} onChange={(e) => setForm({ ...form, distribution: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
        </div>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes: NOI vs proforma, capex progress, leasing, issues…" className="mt-2 h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" />
        <button onClick={add} className="mt-2 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">Add quarter</button>
      </div>
      {state.quarters.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-xs text-slate-500"><tr>
              <th className="px-2 py-1 text-left font-medium">Period</th>
              <th className="px-2 py-1 text-right font-medium">Occupancy</th>
              <th className="px-2 py-1 text-right font-medium">NOI</th>
              <th className="px-2 py-1 text-right font-medium">Distribution</th>
              <th className="px-2 py-1 text-left font-medium">Notes</th>
            </tr></thead>
            <tbody className="tabular-nums">
              {state.quarters.map((q) => (
                <tr key={q.id} className="border-t border-slate-50">
                  <td className="px-2 py-1.5 font-medium">{q.period}</td>
                  <td className="px-2 py-1.5 text-right">{(q.occupancy * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right">{usd(q.noi, { compact: true })}</td>
                  <td className="px-2 py-1.5 text-right">{usd(q.distribution, { compact: true })}</td>
                  <td className="px-2 py-1.5 text-left text-xs text-slate-500">{q.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
