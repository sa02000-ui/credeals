'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { InfoTip } from '@/components/InfoTip';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { dataClient } from '@/lib/supabase/dataClient';
import { PHASES, stageDef, type DealPerson, type DealStage, type MarketDeal } from '@/lib/sim';

const pid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Manage who is on a deal and what they can see/do (Step-2 access model). */
export function DealPeoplePanel({ deal }: { deal: MarketDeal }) {
  const { peopleOf, addPerson, updatePerson, removePerson } = useApp();
  const people = peopleOf(deal.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<'edit' | 'view'>('edit');
  const [profiles, setProfiles] = useState<{ email: string; full_name: string | null }[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      try {
        const { data } = await dataClient().from('profiles').select('email,full_name');
        if (data) setProfiles(data as { email: string; full_name: string | null }[]);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function add(n: string, e?: string, a: 'edit' | 'view' = access) {
    const nm = n.trim();
    if (!nm) return;
    addPerson(deal.id, { id: pid(), name: nm, email: e, access: a, phases: [] });
    setName('');
    setEmail('');
  }

  function togglePhase(p: DealPerson, phase: DealStage) {
    const has = p.phases.includes(phase);
    updatePerson(deal.id, p.id, { phases: has ? p.phases.filter((x) => x !== phase) : [...p.phases, phase] });
  }

  const unassignedProfiles = profiles.filter((pr) => !people.some((pp) => pp.email && pp.email === pr.email));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <span className="text-sm font-semibold text-slate-800">👥 People &amp; access</span>
        <InfoTip title="People & access" what="Who is on this deal and what they can do. Grant edit or view-only, and scope a person to specific phases — e.g. a partner only involved in Contract-to-Close, or an asset manager only after closing." app="Leads in Contract-to-Close and assignees in Asset Management are picked from this list." />
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{people.length}</span>
        <span className="ml-auto text-xs text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          {/* existing people */}
          {people.length === 0 && <p className="mb-2 text-xs text-slate-400">No one assigned yet. The deal owner + admins always have full access.</p>}
          <ul className="space-y-2">
            {people.map((p) => (
              <li key={p.id} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">{p.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{p.name}</div>
                    {p.email && <div className="truncate text-[11px] text-slate-400">{p.email}</div>}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => updatePerson(deal.id, p.id, { access: p.access === 'edit' ? 'view' : 'edit' })} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${p.access === 'edit' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p.access === 'edit' ? '✎ edit' : '👁 view'}
                    </button>
                    <button onClick={() => removePerson(deal.id, p.id)} className="text-slate-300 hover:text-red-500" title="Remove">✕</button>
                  </div>
                </div>
                {/* phase scope */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Involved in:</span>
                  {PHASES.map((ph) => {
                    const on = p.phases.length === 0 || p.phases.includes(ph);
                    return (
                      <button key={ph} onClick={() => togglePhase(p, ph)} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.phases.includes(ph) ? 'bg-indigo-600 text-white' : p.phases.length === 0 ? 'bg-indigo-50 text-indigo-400' : 'bg-slate-100 text-slate-500'}`} title={p.phases.length === 0 ? 'Currently all phases — click to scope' : ''}>
                        {stageDef(ph).short}
                      </button>
                    );
                  })}
                  {p.phases.length === 0 && <span className="text-[10px] text-slate-400">(all phases)</span>}
                </div>
              </li>
            ))}
          </ul>

          {/* add person */}
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1"><span className="text-[11px] text-slate-500">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" placeholder="Partner / teammate" /></label>
              <label className="block flex-1"><span className="text-[11px] text-slate-500">Email (optional)</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none" placeholder="name@company.com" /></label>
              <select value={access} onChange={(e) => setAccess(e.target.value as 'edit' | 'view')} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
                <option value="edit">Can edit</option>
                <option value="view">View only</option>
              </select>
              <button onClick={() => add(name, email || undefined)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">Add</button>
            </div>
            {unassignedProfiles.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Quick add from your org:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {unassignedProfiles.slice(0, 12).map((pr) => (
                    <button key={pr.email} onClick={() => add(pr.full_name || pr.email.split('@')[0], pr.email)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100">
                      + {pr.full_name || pr.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">View-only users can read everything and comment, but not edit. Phase scope limits which steps they work in. (Hard enforcement lands with cloud auth; this manages the model now.)</p>
        </div>
      )}
    </div>
  );
}
