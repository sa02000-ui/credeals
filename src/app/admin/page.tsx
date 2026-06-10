'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { dataClient } from '@/lib/supabase/dataClient';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  billable: boolean;
  created_at: string;
}

interface DealRow {
  id: string;
  name: string;
  stage: string;
}

interface MemberRow {
  deal_id: string;
  user_id: string;
  role: string;
}

async function callAdmin(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false, error: 'Bad response' }));
}

export default function AdminPage() {
  const { isAdmin } = useApp();
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const sb = dataClient();
      const [{ data: profs }, { data: dealRows }, { data: memberRows }] = await Promise.all([
        sb.from('profiles').select('id,email,full_name,is_admin,billable,created_at').order('created_at'),
        sb.from('deals').select('id,name,stage').order('name'),
        sb.from('deal_members').select('deal_id,user_id,role'),
      ]);
      setProfiles((profs ?? []) as unknown as ProfileRow[]);
      setDeals((dealRows ?? []) as unknown as DealRow[]);
      setMembers((memberRows ?? []) as unknown as MemberRow[]);
    } catch {
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(key: string, payload: Record<string, unknown>) {
    setBusy(key);
    setMsg(null);
    const r = await callAdmin(payload);
    setBusy(null);
    if (!r.ok) {
      setMsg(r.error ?? 'Action failed');
      return;
    }
    await load();
  }

  const stageCounts: Record<string, number> = {};
  deals.forEach((d) => (stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1));

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">Admins only</p>
          <p className="mt-1 text-xs text-slate-500">You don&apos;t have access to the admin console.</p>
          <Link href="/app" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Back to workspace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admin console</h1>
          <p className="text-sm text-slate-500">Users, roles, and per-deal access.</p>
        </div>
        <Link href="/app" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
          ← Workspace
        </Link>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={profiles ? String(profiles.length) : '…'} />
        <Stat label="Billable users" value={profiles ? String(profiles.filter((p) => p.billable).length) : '…'} />
        <Stat label="Total deals" value={deals.length.toLocaleString()} />
        <Stat label="Pipeline (non-archived)" value={String(deals.filter((d) => d.stage !== 'archived').length)} />
      </div>

      {/* Pipeline by stage */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Deals by stage</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {['new', 'napkin', 'detailed', 'loi', 'c2c', 'am', 'archived'].map((s) => (
            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {s}: <b>{stageCounts[s] ?? 0}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Users */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Users &amp; roles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Billable</th>
                <th className="px-4 py-2 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles === null && (
                <tr><td colSpan={5} className="px-4 py-3 text-xs text-slate-400">Loading…</td></tr>
              )}
              {profiles?.map((p) => (
                <tr key={p.id} className="border-t border-slate-50">
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2 text-slate-600">{p.full_name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      disabled={busy === `role-${p.id}`}
                      onClick={() => act(`role-${p.id}`, { action: 'set-role', userId: p.id, isAdmin: !p.is_admin })}
                      title={p.is_admin ? 'Demote to member' : 'Promote to admin'}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
                        p.is_admin ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.is_admin ? 'admin' : 'member'} ⇄
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      disabled={busy === `bill-${p.id}`}
                      onClick={() => act(`bill-${p.id}`, { action: 'set-billable', userId: p.id, billable: !p.billable })}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
                        p.billable ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.billable ? 'billable' : 'free'} ⇄
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-deal assignment */}
      {profiles && (
        <DealAssignment
          deals={deals}
          profiles={profiles}
          members={members}
          busy={busy}
          onAssign={(dealId, userId) => act(`assign-${dealId}-${userId}`, { action: 'assign-deal', dealId, userId })}
          onUnassign={(dealId, userId) => act(`unassign-${dealId}-${userId}`, { action: 'unassign-deal', dealId, userId })}
        />
      )}

      <p className="mt-4 text-xs text-slate-400">
        Roles and per-deal edit grants apply immediately (service-role, RLS-bypassing, admin-verified). All users can
        view every deal; assigning a user grants them edit rights on that specific deal (the Monday access model).
      </p>
    </main>
  );
}

function DealAssignment({
  deals,
  profiles,
  members,
  busy,
  onAssign,
  onUnassign,
}: {
  deals: DealRow[];
  profiles: ProfileRow[];
  members: MemberRow[];
  busy: string | null;
  onAssign: (dealId: string, userId: string) => void;
  onUnassign: (dealId: string, userId: string) => void;
}) {
  const [dealId, setDealId] = useState<string>(deals[0]?.id ?? '');
  const [userId, setUserId] = useState<string>('');

  const dealMembers = members.filter((m) => m.deal_id === dealId);
  const assignedIds = new Set(dealMembers.map((m) => m.user_id));
  const assignable = profiles.filter((p) => !assignedIds.has(p.id));
  const emailOf = (id: string) => profiles.find((p) => p.id === id)?.email ?? id;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Per-deal access</h2>
        <p className="text-xs text-slate-500">Grant a user edit rights on a specific deal.</p>
      </div>
      <div className="p-4">
        {deals.length === 0 ? (
          <p className="text-xs text-slate-400">No deals yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Deal</span>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="block w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                >
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">User to grant edit</span>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="block w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Select a user…</option>
                  {assignable.map((p) => (
                    <option key={p.id} value={p.id}>{p.email}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={!dealId || !userId || busy === `assign-${dealId}-${userId}`}
                onClick={() => { onAssign(dealId, userId); setUserId(''); }}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Grant edit
              </button>
            </div>

            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold text-slate-600">Editors on this deal</h3>
              {dealMembers.length === 0 ? (
                <p className="text-xs text-slate-400">No editors assigned (owner + admins can always edit).</p>
              ) : (
                <ul className="space-y-1">
                  {dealMembers.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm">
                      <span className="text-slate-700">{emailOf(m.user_id)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{m.role}</span>
                      <button
                        disabled={busy === `unassign-${dealId}-${m.user_id}`}
                        onClick={() => onUnassign(dealId, m.user_id)}
                        className="ml-auto text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
