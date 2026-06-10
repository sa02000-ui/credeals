'use client';

/**
 * Admin Scenario Builder — the fillable authoring tool for branching game scenarios.
 * Create scenarios → add steps → add options (effects, result) → branch with weights, and
 * cross-reference any step ("stepId" within this scenario, or "otherScenario:stepId" to jump
 * across scenarios; blank = END). Severity + status let the admin tune harshness / turn content on.
 *
 * Storage: Supabase `scenarios` table (migration 0002) when available; otherwise localStorage with
 * a banner — export/import JSON works either way.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { dataClient } from '@/lib/supabase/dataClient';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { readCookieSession } from '@/lib/supabase/token';
import { buildC2CScenarios, type ScenarioOption, type ScenarioStep } from '@/lib/sim';

type Phase = 'buybox' | 'sourcing' | 'napkin' | 'loi' | 'psa' | 'c2c' | 'am' | 'other';
type Status = 'draft' | 'active' | 'off';

interface ScenarioRecord {
  id: string;
  title: string;
  phase: Phase;
  severity: number;
  status: Status;
  entry: string;
  steps: Record<string, ScenarioStep>;
  notes?: string;
}

const LS_KEY = 'cre-admin-scenarios-v1';
const PHASES: Phase[] = ['buybox', 'sourcing', 'napkin', 'loi', 'psa', 'c2c', 'am', 'other'];
const sid = () => `s${Date.now().toString(36)}`;

export default function ScenarioBuilderPage() {
  const { isAdmin } = useApp();
  const [records, setRecords] = useState<ScenarioRecord[]>([]);
  const [cloud, setCloud] = useState<boolean | null>(null); // null=loading, false=local fallback
  const [selId, setSelId] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await dataClient().from('scenarios').select('*').order('updated_at', { ascending: false });
        if (!error && data) {
          setRecords(data as unknown as ScenarioRecord[]);
          setCloud(true);
          return;
        }
      } catch { /* fall through to local */ }
    }
    setCloud(false);
    try {
      const rawLs = localStorage.getItem(LS_KEY);
      if (rawLs) setRecords(JSON.parse(rawLs) as ScenarioRecord[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const persistLocal = (list: ScenarioRecord[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* ignore */ } };

  async function save(rec: ScenarioRecord) {
    setMsg(null);
    const list = records.some((r) => r.id === rec.id) ? records.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...records];
    setRecords(list);
    if (cloud) {
      const sess = readCookieSession();
      const { error } = await dataClient().from('scenarios').upsert({ ...rec, updated_by: sess?.userId ?? null } as never);
      if (error) { setMsg(`Cloud save failed (${error.message}) — kept locally.`); persistLocal(list); }
      else setMsg('Saved to cloud.');
    } else {
      persistLocal(list);
      setMsg('Saved locally (run migration 0002 to sync to cloud).');
    }
  }

  async function remove(id: string) {
    if (!confirm(`Delete scenario "${id}"?`)) return;
    const list = records.filter((r) => r.id !== id);
    setRecords(list);
    if (selId === id) setSelId(null);
    if (cloud) await dataClient().from('scenarios').delete().eq('id', id);
    else persistLocal(list);
  }

  function createNew() {
    const rec: ScenarioRecord = {
      id: sid(), title: 'New scenario', phase: 'c2c', severity: 50, status: 'draft', entry: 'start',
      steps: { start: { id: 'start', speaker: 'Broker', prompt: 'Describe the situation…', options: [{ id: 'opt1', label: 'First option', tone: 'good' }] } },
    };
    void save(rec);
    setSelId(rec.id);
  }

  function importBuiltins() {
    const built = buildC2CScenarios({ market: 'balanced', difficulty: 'standard', missedPSATraps: 1 });
    const list = [...records];
    for (const s of built) {
      if (list.some((r) => r.id === s.id)) continue;
      list.unshift({ id: s.id, title: s.title, phase: 'c2c', severity: 50, status: 'active', entry: s.entry, steps: s.steps, notes: 'Imported from built-in C2C deck.' });
    }
    setRecords(list);
    if (cloud) { for (const r of list) void dataClient().from('scenarios').upsert(r as never); } else persistLocal(list);
    setMsg('Built-in C2C scenarios imported — edit away.');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'scenarios.json'; a.click();
    URL.revokeObjectURL(url);
  }

  const sel = records.find((r) => r.id === selId) ?? null;

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">Admins only</p>
          <Link href="/app" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to workspace</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-bold">🎬 Scenario Builder</h1>
          <p className="text-sm text-slate-500">Author branching game scenarios — steps, options, weighted branches, cross-references.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={createNew} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">+ New scenario</button>
          <button onClick={importBuiltins} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Import built-ins</button>
          <button onClick={exportJson} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Export JSON</button>
          <Link href="/admin" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">← Admin</Link>
        </div>
      </div>

      {cloud === false && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Cloud table not found — scenarios are saved in this browser only. Run <code className="rounded bg-amber-100 px-1">supabase/migrations/0002_scenarios.sql</code> in the Supabase SQL Editor to enable shared cloud storage, then reload.
        </div>
      )}
      {msg && <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* List */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold">Scenarios ({records.length})</div>
          <ul className="max-h-[70vh] divide-y divide-slate-50 overflow-y-auto">
            {records.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">None yet — create one or import the built-ins.</li>}
            {records.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelId(r.id)} className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${selId === r.id ? 'bg-slate-100' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-800">{r.title}</span>
                    <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : r.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="rounded bg-indigo-50 px-1 text-indigo-600">{r.phase}</span>
                    <span>{Object.keys(r.steps).length} steps</span>
                    <span>sev {r.severity}</span>
                    <span className="truncate">#{r.id}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        {sel ? (
          <ScenarioEditor key={sel.id} rec={sel} allIds={records.map((r) => r.id)} raw={raw} setRaw={setRaw} onSave={save} onDelete={() => remove(sel.id)} />
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">Select a scenario on the left, or create a new one.</div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        Next/jump references: a step id within this scenario (e.g. <code>a_refuse</code>), a cross-scenario jump <code>otherScenarioId:stepId</code> (e.g. <code>raise:r_short</code>), or blank = the scenario ends. Severity (0–100) will scale effect harshness in-game. Set status to <b>active</b> to make it eligible for play once the game loads authored scenarios.
      </p>
    </main>
  );
}

// ---------------------------------------------------------------------------

function ScenarioEditor({ rec, allIds, raw, setRaw, onSave, onDelete }: {
  rec: ScenarioRecord; allIds: string[]; raw: boolean; setRaw: (v: boolean) => void;
  onSave: (r: ScenarioRecord) => void; onDelete: () => void;
}) {
  const [r, setR] = useState<ScenarioRecord>(rec);
  const [rawText, setRawText] = useState('');
  const [dirty, setDirty] = useState(false);
  const set = (patch: Partial<ScenarioRecord>) => { setR((s) => ({ ...s, ...patch })); setDirty(true); };

  const setStep = (stepId: string, patch: Partial<ScenarioStep>) =>
    set({ steps: { ...r.steps, [stepId]: { ...r.steps[stepId], ...patch } } });
  const addStep = () => {
    let n = Object.keys(r.steps).length + 1;
    let id = `step${n}`;
    while (r.steps[id]) id = `step${++n}`;
    set({ steps: { ...r.steps, [id]: { id, speaker: '', prompt: '', options: [] } } });
  };
  const removeStep = (stepId: string) => {
    const steps = { ...r.steps };
    delete steps[stepId];
    set({ steps });
  };
  const renameStep = (oldId: string, newId: string) => {
    if (!newId || r.steps[newId]) return;
    const steps: Record<string, ScenarioStep> = {};
    for (const [k, v] of Object.entries(r.steps)) steps[k === oldId ? newId : k] = k === oldId ? { ...v, id: newId } : v;
    set({ steps, entry: r.entry === oldId ? newId : r.entry });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <input value={r.title} onChange={(e) => set({ title: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-base font-bold text-slate-900 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
        <button onClick={() => { setRaw(!raw); setRawText(JSON.stringify(r, null, 2)); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">{raw ? 'Form view' : 'Raw JSON'}</button>
        <button onClick={onDelete} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
        <button onClick={() => { onSave(r); setDirty(false); }} className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white ${dirty ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300'}`}>💾 Save{dirty ? ' *' : ''}</button>
      </div>

      {raw ? (
        <div className="p-3">
          <textarea value={rawText || JSON.stringify(r, null, 2)} onChange={(e) => setRawText(e.target.value)} spellCheck={false} className="h-[60vh] w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs focus:outline-none" />
          <button onClick={() => { try { setR(JSON.parse(rawText) as ScenarioRecord); setDirty(true); setRaw(false); } catch { alert('Invalid JSON'); } }} className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100">Apply JSON → form</button>
        </div>
      ) : (
        <div className="p-3">
          {/* meta */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="block"><span className="text-[11px] text-slate-500">Id (slug)</span>
              <input value={r.id} disabled className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-500" /></label>
            <label className="block"><span className="text-[11px] text-slate-500">Phase</span>
              <select value={r.phase} onChange={(e) => set({ phase: e.target.value as Phase })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                {PHASES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select></label>
            <label className="block"><span className="text-[11px] text-slate-500">Status</span>
              <select value={r.status} onChange={(e) => set({ status: e.target.value as Status })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                <option value="draft">draft</option><option value="active">active</option><option value="off">off</option>
              </select></label>
            <label className="block"><span className="text-[11px] text-slate-500">Severity: <b>{r.severity}</b></span>
              <input type="range" min={0} max={100} value={r.severity} onChange={(e) => set({ severity: Number(e.target.value) })} className="w-full" /></label>
            <label className="block"><span className="text-[11px] text-slate-500">Entry step</span>
              <select value={r.entry} onChange={(e) => set({ entry: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                {Object.keys(r.steps).map((s) => (<option key={s} value={s}>{s}</option>))}
              </select></label>
          </div>
          <label className="mt-2 block"><span className="text-[11px] text-slate-500">Notes (for you / for Claude)</span>
            <input value={r.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" placeholder="Intent, tuning ideas, where it should fire…" /></label>

          {/* steps */}
          <div className="mt-4 space-y-3">
            {Object.values(r.steps).map((step) => (
              <StepEditor key={step.id} step={step} stepIds={Object.keys(r.steps)} allScenarioIds={allIds}
                onChange={(p) => setStep(step.id, p)} onRename={(nid) => renameStep(step.id, nid)} onRemove={() => removeStep(step.id)} />
            ))}
          </div>
          <button onClick={addStep} className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">+ Add step</button>
        </div>
      )}
    </div>
  );
}

function StepEditor({ step, stepIds, allScenarioIds, onChange, onRename, onRemove }: {
  step: ScenarioStep; stepIds: string[]; allScenarioIds: string[];
  onChange: (p: Partial<ScenarioStep>) => void; onRename: (newId: string) => void; onRemove: () => void;
}) {
  const setOpt = (i: number, patch: Partial<ScenarioOption>) =>
    onChange({ options: step.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const addOpt = () => onChange({ options: [...step.options, { id: `opt${step.options.length + 1}`, label: 'New option', tone: 'warn' }] });
  const rmOpt = (i: number) => onChange({ options: step.options.filter((_, k) => k !== i) });

  return (
    <div className="rounded-lg border-2 border-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Step</span>
        <input defaultValue={step.id} onBlur={(e) => e.target.value !== step.id && onRename(e.target.value.trim())} className="w-28 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs focus:outline-none" title="Step id (rename here)" />
        <input value={step.speaker ?? ''} onChange={(e) => onChange({ speaker: e.target.value })} placeholder="Speaker (Broker / Seller / Lender…)" className="w-44 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs focus:outline-none" />
        <button onClick={onRemove} className="ml-auto text-xs text-red-500 hover:text-red-700">remove step</button>
      </div>
      <div className="p-3">
        <textarea value={step.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="The situation / question the player sees…" className="h-14 w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" />
        <div className="mt-2 space-y-2">
          {step.options.map((opt, i) => (
            <OptionEditor key={i} opt={opt} stepIds={stepIds} allScenarioIds={allScenarioIds} onChange={(p) => setOpt(i, p)} onRemove={() => rmOpt(i)} />
          ))}
        </div>
        <button onClick={addOpt} className="mt-2 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">+ Add option</button>
      </div>
    </div>
  );
}

function OptionEditor({ opt, stepIds, allScenarioIds, onChange, onRemove }: {
  opt: ScenarioOption; stepIds: string[]; allScenarioIds: string[];
  onChange: (p: Partial<ScenarioOption>) => void; onRemove: () => void;
}) {
  const e = opt.effects ?? {};
  const setEff = (patch: Partial<NonNullable<ScenarioOption['effects']>>) => onChange({ effects: { ...e, ...patch } });
  const flags = Object.keys(e.set ?? {}).join(', ');
  const branches = opt.branches ?? [];
  const setBranch = (i: number, patch: Partial<(typeof branches)[number]>) => onChange({ branches: branches.map((b, k) => (k === i ? { ...b, ...patch } : b)) });

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={opt.label} onChange={(ev) => onChange({ label: ev.target.value })} placeholder="Button label" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-semibold focus:outline-none" />
        <select value={opt.tone ?? 'warn'} onChange={(ev) => onChange({ tone: ev.target.value as ScenarioOption['tone'] })} className="rounded-md border border-slate-300 bg-white px-1 py-0.5 text-[11px] focus:outline-none">
          <option value="good">good</option><option value="warn">warn</option><option value="bad">bad</option>
        </select>
        <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">✕</button>
      </div>
      <input value={opt.detail ?? ''} onChange={(ev) => onChange({ detail: ev.target.value })} placeholder="One-line helper (optional)" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] focus:outline-none" />
      <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-6">
        <LabeledNum label="cash $" v={e.cash ?? 0} onChange={(v) => setEff({ cash: v || undefined })} />
        <LabeledNum label="days" v={e.days ?? 0} onChange={(v) => setEff({ days: v || undefined })} />
        <LabeledNum label="rep broker" v={e.rep?.broker ?? 0} onChange={(v) => setEff({ rep: { ...e.rep, broker: v || undefined } })} />
        <LabeledNum label="rep lender" v={e.rep?.lender ?? 0} onChange={(v) => setEff({ rep: { ...e.rep, lender: v || undefined } })} />
        <LabeledNum label="rep LP" v={e.rep?.lp ?? 0} onChange={(v) => setEff({ rep: { ...e.rep, lp: v || undefined } })} />
        <label className="block"><span className="text-[9px] uppercase text-slate-400">flags (csv)</span>
          <input value={flags} onChange={(ev) => { const s: Record<string, boolean> = {}; ev.target.value.split(',').map((x) => x.trim()).filter(Boolean).forEach((f) => (s[f] = true)); setEff({ set: Object.keys(s).length ? s : undefined }); }} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] focus:outline-none" placeholder="ddDone, walk" /></label>
      </div>
      <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <label className="block"><span className="text-[9px] uppercase text-slate-400">result narration</span>
          <input value={opt.result ?? ''} onChange={(ev) => onChange({ result: ev.target.value })} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] focus:outline-none" placeholder="What happens after choosing…" /></label>
        <label className="block"><span className="text-[9px] uppercase text-slate-400">next (stepId · scenario:step · blank=END)</span>
          <input value={opt.next ?? ''} onChange={(ev) => onChange({ next: ev.target.value || undefined })} list="step-ids" className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[11px] focus:outline-none" placeholder="a_refuse  ·  raise:r_short" />
          <datalist id="step-ids">{stepIds.map((s) => (<option key={s} value={s} />))}{allScenarioIds.map((s) => (<option key={`x-${s}`} value={`${s}:`} />))}</datalist></label>
      </div>

      {/* branches */}
      <div className="mt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase text-slate-400">Uncertain outcome (weighted branches — overrides next)</span>
          <button onClick={() => onChange({ branches: [...branches, { weight: 50 }] })} className="rounded border border-dashed border-slate-300 px-1.5 text-[10px] text-slate-500 hover:bg-slate-100">+ branch</button>
        </div>
        {branches.map((b, i) => (
          <div key={i} className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-violet-200 bg-violet-50/50 p-1.5">
            <label className="flex items-center gap-1 text-[10px] text-slate-500">wt
              <input type="number" value={b.weight} onChange={(ev) => setBranch(i, { weight: Number(ev.target.value) })} className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] tabular-nums focus:outline-none" /></label>
            <input value={b.result ?? ''} onChange={(ev) => setBranch(i, { result: ev.target.value })} placeholder="branch narration" className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] focus:outline-none" />
            <input value={b.next ?? ''} onChange={(ev) => setBranch(i, { next: ev.target.value || undefined })} placeholder="next" className="w-24 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[11px] focus:outline-none" />
            <LabeledNum label="$" v={b.effects?.cash ?? 0} onChange={(v) => setBranch(i, { effects: { ...b.effects, cash: v || undefined } })} tiny />
            <LabeledNum label="d" v={b.effects?.days ?? 0} onChange={(v) => setBranch(i, { effects: { ...b.effects, days: v || undefined } })} tiny />
            <input value={Object.keys(b.effects?.set ?? {}).join(', ')} onChange={(ev) => { const s: Record<string, boolean> = {}; ev.target.value.split(',').map((x) => x.trim()).filter(Boolean).forEach((f) => (s[f] = true)); setBranch(i, { effects: { ...b.effects, set: Object.keys(s).length ? s : undefined } }); }} placeholder="flags" className="w-24 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] focus:outline-none" />
            <button onClick={() => onChange({ branches: branches.filter((_, k) => k !== i) })} className="text-xs text-red-400 hover:text-red-600">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabeledNum({ label, v, onChange, tiny }: { label: string; v: number; onChange: (n: number) => void; tiny?: boolean }) {
  return (
    <label className={tiny ? 'flex items-center gap-1 text-[10px] text-slate-500' : 'block'}>
      {!tiny && <span className="text-[9px] uppercase text-slate-400">{label}</span>}
      {tiny && label}
      <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} className={`rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] tabular-nums focus:outline-none ${tiny ? 'w-16' : 'w-full'}`} />
    </label>
  );
}
