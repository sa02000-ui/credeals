'use client';

/**
 * Contract-to-Close and Asset-Management phase panels.
 * - C2C: upload the signed PSA, set the execution date, and a full critical-dates project plan split
 *   into workstreams (Main, Title & Survey, Debt, Insurance, Capital Raise, Due Diligence, Legal),
 *   rolled up into a master plan. Keeps the game-mode capital-raise mini-game.
 * - AM: takeover + ongoing cadence checklists, recurring reminders (incl. annual tax protest /
 *   insurance compare / K-1 / cost seg) and quarterly performance logging.
 */

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { InfoTip } from '@/components/InfoTip';
import { resolveCapitalRaise, usd, type MarketDeal, type RaiseOutcome } from '@/lib/sim';

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
  offset: number; // days after PSA execution the task starts
  duration: number; // days
  critical?: boolean; // hard deadline
}

// Critical-dates engine derived from the real Contract-to-Close tracker (functionality_maps §C).
const C2C_TASKS: TaskDef[] = [
  { id: 'psa', ws: 'Main', label: 'PSA executed', lead: 'Sponsor', offset: 0, duration: 0, critical: true },
  { id: 'emd', ws: 'Main', label: 'Earnest money to title', lead: 'Sponsor', offset: 0, duration: 3, critical: true },
  { id: 'access', ws: 'Main', label: 'Temporary access agreement', lead: 'Sponsor', offset: 0, duration: 5 },
  { id: 'closingdocs', ws: 'Main', label: 'Closing docs + HUD settlement statement', lead: 'Title', offset: 53, duration: 7 },
  { id: 'close', ws: 'Main', label: 'Close / distribute funds', lead: 'All', offset: 60, duration: 0, critical: true },

  { id: 'title-order', ws: 'Title & Survey', label: 'Order title commitment', lead: 'Title', offset: 1, duration: 0 },
  { id: 'title-review', ws: 'Title & Survey', label: 'Review title commitment', lead: 'Legal', offset: 1, duration: 30 },
  { id: 'survey', ws: 'Title & Survey', label: 'Order + review ALTA survey', lead: 'Surveyor', offset: 1, duration: 30 },
  { id: 'title-obj', ws: 'Title & Survey', label: 'Title/survey objections + cures', lead: 'Legal', offset: 31, duration: 7 },

  { id: 'debt-quotes', ws: 'Debt', label: 'Request 5 debt quotes', lead: 'Sponsor', offset: 1, duration: 15 },
  { id: 'debt-decide', ws: 'Debt', label: 'Decide lender', lead: 'Sponsor', offset: 16, duration: 2 },
  { id: 'debt-docs', ws: 'Debt', label: 'Provide docs to lender', lead: 'Sponsor', offset: 18, duration: 15 },
  { id: 'appraisal', ws: 'Debt', label: 'Appraisal ordered + delivered', lead: 'Lender', offset: 18, duration: 21 },
  { id: 'loan-commit', ws: 'Debt', label: 'Loan commitment / financing contingency', lead: 'Lender', offset: 1, duration: 45, critical: true },
  { id: 'rate-lock', ws: 'Debt', label: 'Rate lock', lead: 'Sponsor', offset: 47, duration: 3 },

  { id: 'ins-quotes', ws: 'Insurance', label: 'Request insurance quotes', lead: 'Broker', offset: 5, duration: 14 },
  { id: 'ins-bind', ws: 'Insurance', label: 'Bind insurance (effective at close)', lead: 'Broker', offset: 50, duration: 5 },

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
  done: boolean;
  pct: number;
}
interface C2CState {
  startDate: string; // ISO yyyy-mm-dd of PSA execution
  overrides: Record<string, TaskOverride>;
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function C2CPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf, addFiles } = useApp();
  const files = filesOf(deal.id);
  const psa = files.find((f) => f.kind === 'PSA');

  const [state, setState] = useDealLocal<C2CState>('c2c', deal.id, {
    startDate: new Date().toISOString().slice(0, 10),
    overrides: {},
  });
  const [filter, setFilter] = useState<Workstream | 'All'>('All');

  const ov = (id: string): TaskOverride => state.overrides[id] ?? { done: false, pct: 0 };
  const setOv = (id: string, patch: Partial<TaskOverride>) =>
    setState((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...ov(id), ...patch } } }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = useMemo(() => {
    return C2C_TASKS.map((t) => {
      const start = addDays(state.startDate, t.offset);
      const due = addDays(state.startDate, t.offset + t.duration);
      const o = state.overrides[t.id] ?? { done: false, pct: 0 };
      const overdue = !o.done && due < today;
      const dueSoon = !o.done && !overdue && (due.getTime() - today.getTime()) / 86400000 <= 7;
      return { t, start, due, o, overdue, dueSoon };
    });
  }, [state, today]);

  const visible = rows.filter((r) => filter === 'All' || r.t.ws === filter);
  const doneCount = rows.filter((r) => r.o.done).length;
  const overdueCount = rows.filter((r) => r.overdue).length;
  const progress = Math.round((doneCount / rows.length) * 100);

  function onPickPsa(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    addFiles(deal.id, [{ id: `${deal.id}-psa-${Date.now()}`, name: f.name, kind: 'PSA', sizeBytes: f.size, ts: Date.now() }]);
    e.target.value = '';
  }

  return (
    <PhaseShell
      title="Contract to Close"
      info="step.c2c"
      subtitle="Upload the signed PSA, anchor the critical-dates calendar, and drive every workstream to the closing table."
    >
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
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-medium text-slate-500 hover:bg-slate-50">
              + Upload signed PSA
              <input type="file" className="hidden" onChange={onPickPsa} />
            </label>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">PSA execution date <InfoTip k="c2c.criticalDates" /></div>
          <input
            type="date"
            value={state.startDate}
            onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value }))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">Every task date below is computed from this date.</p>
        </div>
      </div>

      {/* Master plan progress */}
      <div className="mt-4 rounded-lg border border-slate-200 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Master project plan</span>
          <span className="text-slate-500">{doneCount}/{rows.length} done · {overdueCount > 0 ? <span className="font-semibold text-red-600">{overdueCount} overdue</span> : <span className="text-emerald-600">on track</span>}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {/* Workstream filter */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip label="All" active={filter === 'All'} onClick={() => setFilter('All')} />
          {WORKSTREAMS.map((w) => (
            <FilterChip key={w.id} label={w.id} active={filter === w.id} dot={w.color} onClick={() => setFilter(w.id)} />
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium">✓</th>
              <th className="px-2 py-1 text-left font-medium">Task</th>
              <th className="px-2 py-1 text-left font-medium">Workstream</th>
              <th className="px-2 py-1 text-left font-medium">Lead</th>
              <th className="px-2 py-1 text-right font-medium">Due</th>
              <th className="px-2 py-1 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ t, due, o, overdue, dueSoon }) => {
              const ws = WORKSTREAMS.find((w) => w.id === t.ws)!;
              return (
                <tr key={t.id} className="border-t border-slate-50">
                  <td className="px-2 py-1.5">
                    <input type="checkbox" checked={o.done} onChange={(e) => setOv(t.id, { done: e.target.checked, pct: e.target.checked ? 100 : o.pct })} className="h-4 w-4 rounded border-slate-300" />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={o.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.label}</span>
                    {t.critical && <span className="ml-1.5 rounded bg-red-100 px-1 text-[9px] font-semibold text-red-700">critical</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600"><span className={`h-2 w-2 rounded-full ${ws.color}`} />{t.ws}</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-500">{t.lead}</td>
                  <td className={`px-2 py-1.5 text-right text-xs tabular-nums ${overdue ? 'font-semibold text-red-600' : dueSoon ? 'font-semibold text-amber-600' : 'text-slate-600'}`}>
                    {fmtDate(due)}{overdue && ' ⚠'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input type="number" min={0} max={100} value={o.pct} onChange={(e) => setOv(t.id, { pct: Number(e.target.value), done: Number(e.target.value) >= 100 })}
                      className="w-14 rounded-md border border-slate-200 px-1 py-0.5 text-right text-xs tabular-nums focus:border-slate-400 focus:outline-none" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Game-mode capital raise */}
      <CapitalRaise deal={deal} />
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

function CapitalRaise({ deal }: { deal: MarketDeal }) {
  const { mode, game, applyGameOutcome, setStatus, statusOf } = useApp();
  const equityNeeded = Math.round(deal.askPrice * 0.35);
  const [strategy, setStrategy] = useState<'solo' | 'partners'>('solo');
  const [outcome, setOutcome] = useState<RaiseOutcome | null>(null);
  const closed = statusOf(deal.id) === 'am' || statusOf(deal.id) === 'archived';
  if (mode !== 'game') return null;

  function runRaise(s: 'solo' | 'partners') {
    const o = resolveCapitalRaise({ equityNeeded, strategy: s, market: game.market, lpRep: game.reputation.lp, dealsClosed: game.dealsClosed });
    setOutcome(o);
    if (o.success) {
      applyGameOutcome({ dealId: deal.id, repDelta: { lp: o.repLpDelta }, closed: true, event: { title: `Closed: ${deal.name}`, detail: `${o.message} (${s === 'partners' ? 'with capital partners' : 'solo raise'})`, lesson: o.lesson } });
      setStatus(deal.id, 'am');
    } else {
      applyGameOutcome({ dealId: deal.id, repDelta: { lp: o.repLpDelta }, event: { title: `Raise short: ${deal.name}`, detail: o.message, lesson: o.lesson } });
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">🤝 Raise the equity <InfoTip k="r.waterfall" /></h3>
      <p className="mt-1 text-xs text-slate-600">This deal needs <b>{usd(equityNeeded, { compact: true })}</b> of equity (≈35% of price). Raise it yourself or bring capital partners (wider reach, shared promote).</p>
      {closed ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">✅ Capital is in and the deal is closed — it&apos;s now in Asset Management.</div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            {(['solo', 'partners'] as const).map((s) => (
              <button key={s} onClick={() => setStrategy(s)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${strategy === s ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                {s === 'solo' ? 'Raise solo' : 'Bring capital partners'}
              </button>
            ))}
            <button onClick={() => runRaise(strategy)} className="ml-auto rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700">Launch the raise →</button>
          </div>
          {outcome && (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${outcome.success ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="font-semibold">{outcome.success ? '✅ Fully funded' : '⚠️ Short'} — {outcome.message}</div>
              <div className="mt-1 text-xs text-slate-500">Capacity {usd(outcome.capacity, { compact: true })} · raised {usd(outcome.raised, { compact: true })}</div>
              <div className="mt-1 text-xs text-slate-600">💡 {outcome.lesson}</div>
              {!outcome.success && outcome.recovery && (
                <div className="mt-2">
                  <div className="text-xs text-amber-800">Recovery: {outcome.recovery}</div>
                  {strategy === 'solo' && (
                    <button onClick={() => { setStrategy('partners'); runRaise('partners'); }} className="mt-2 rounded-md border border-amber-400 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                      Bring in capital partners and re-raise
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
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
  nextDue: string; // ISO
  lastDone?: string;
}

interface QuarterLog {
  id: string;
  period: string;
  occupancy: number;
  noi: number;
  distribution: number;
  notes: string;
}

interface AMState {
  takeover: Record<string, boolean>;
  reminders: Reminder[];
  quarters: QuarterLog[];
  seeded: boolean;
}

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
  const [state, setState] = useDealLocal<AMState>('am', deal.id, { takeover: {}, reminders: [], quarters: [], seeded: false });
  const reminders = state.seeded ? state.reminders : seedReminders();
  const [tab, setTab] = useState<'reminders' | 'quarterly' | 'takeover'>('reminders');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function completeReminder(id: string) {
    setState((s) => {
      const list = (s.seeded ? s.reminders : seedReminders()).map((r) => {
        if (r.id !== id) return r;
        const next = new Date(); next.setDate(next.getDate() + CADENCE_DAYS[r.cadence]);
        return { ...r, lastDone: new Date().toISOString().slice(0, 10), nextDue: next.toISOString().slice(0, 10) };
      });
      return { ...s, seeded: true, reminders: list };
    });
  }

  const sortedReminders = [...reminders].sort((a, b) => a.nextDue.localeCompare(b.nextDue));

  return (
    <PhaseShell
      title="Asset Management"
      info="step.am"
      subtitle="Run the takeover, then operate the hold: occupancy & NOI vs. proforma, distributions, recurring obligations, and quarterly reporting."
    >
      <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {([['reminders', 'Reminders & tasks'], ['quarterly', 'Quarterly performance'], ['takeover', 'Takeover checklist']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>

      {tab === 'reminders' && (
        <div className="space-y-1.5">
          <p className="mb-2 text-xs text-slate-500">Recurring obligations — complete one to auto-schedule the next. Annual items (tax protest, insurance compare, K-1, cost seg) are the ones most easily missed.</p>
          {sortedReminders.map((r) => {
            const due = new Date(r.nextDue + 'T00:00:00');
            const overdue = due < today;
            const soon = !overdue && (due.getTime() - today.getTime()) / 86400000 <= 14;
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cadenceColor(r.cadence)}`}>{r.cadence}</span>
                <span className="text-slate-700">{r.label}</span>
                {r.info && <InfoTip k={r.info} />}
                <span className={`ml-auto text-xs tabular-nums ${overdue ? 'font-semibold text-red-600' : soon ? 'font-semibold text-amber-600' : 'text-slate-500'}`}>
                  {overdue ? 'overdue · ' : 'due '}{fmtDate(due)}
                </span>
                <button onClick={() => completeReminder(r.id)} className="rounded-md border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Done</button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'quarterly' && <QuarterlyLog state={state} setState={setState} />}

      {tab === 'takeover' && (
        <div className="space-y-1.5">
          {TAKEOVER.map((label) => {
            const on = !!state.takeover[label];
            return (
              <label key={label} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm">
                <input type="checkbox" checked={on} onChange={(e) => setState((s) => ({ ...s, takeover: { ...s.takeover, [label]: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                <span className={on ? 'text-slate-400 line-through' : 'text-slate-700'}>{label}</span>
              </label>
            );
          })}
          <p className="mt-2 text-xs text-slate-500">Connects to the live AM Portal (massiveam.com) pattern. Operating analysis vs. the proforma you promised lands in the Analysis tab next.</p>
        </div>
      )}
    </PhaseShell>
  );
}

function cadenceColor(c: Cadence): string {
  return c === 'weekly' ? 'bg-sky-100 text-sky-700' : c === 'monthly' ? 'bg-indigo-100 text-indigo-700' : c === 'quarterly' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700';
}

function QuarterlyLog({ state, setState }: { state: AMState; setState: (v: AMState | ((p: AMState) => AMState)) => void }) {
  const [form, setForm] = useState<Omit<QuarterLog, 'id'>>({
    period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
    occupancy: 0.93,
    noi: 0,
    distribution: 0,
    notes: '',
  });
  function add() {
    setState((s) => ({ ...s, quarters: [{ id: `q${Date.now()}`, ...form }, ...s.quarters] }));
    setForm((f) => ({ ...f, noi: 0, distribution: 0, notes: '' }));
  }
  return (
    <div>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">Log this quarter <InfoTip k="am.occupancy" /></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block"><span className="text-[11px] text-slate-500">Period</span>
            <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">Occupancy %</span>
            <input type="number" value={+(form.occupancy * 100).toFixed(1)} onChange={(e) => setForm({ ...form, occupancy: Number(e.target.value) / 100 })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">NOI ($)</span>
            <input type="number" value={form.noi} onChange={(e) => setForm({ ...form, noi: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
          <label className="block"><span className="text-[11px] text-slate-500">Distribution ($)</span>
            <input type="number" value={form.distribution} onChange={(e) => setForm({ ...form, distribution: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" /></label>
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
