'use client';

import { useEffect, useState } from 'react';
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

export default function AdminPage() {
  const { isAdmin } = useApp();
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [dealCount, setDealCount] = useState<number | null>(null);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sb = dataClient();
        const { data: profs } = await sb.from('profiles').select('id,email,full_name,is_admin,billable,created_at').order('created_at');
        const { count } = await sb.from('deals').select('id', { count: 'exact', head: true });
        const { data: deals } = await sb.from('deals').select('stage');
        if (!active) return;
        setProfiles((profs ?? []) as unknown as ProfileRow[]);
        setDealCount(count ?? 0);
        const sc: Record<string, number> = {};
        (deals as { stage: string }[] | null)?.forEach((d) => (sc[d.stage] = (sc[d.stage] ?? 0) + 1));
        setStageCounts(sc);
      } catch {
        if (active) setProfiles([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
          <p className="text-sm text-slate-500">Users, roles, and deal pipeline.</p>
        </div>
        <Link href="/app" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
          ← Workspace
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={profiles ? String(profiles.length) : '…'} />
        <Stat label="Billable users" value={profiles ? String(profiles.filter((p) => p.billable).length) : '…'} />
        <Stat label="Total deals" value={dealCount != null ? dealCount.toLocaleString() : '…'} />
        <Stat label="Pipeline (non-archived)" value={String(Object.entries(stageCounts).filter(([s]) => s !== 'archived').reduce((a, [, n]) => a + n, 0))} />
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
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Users</h2>
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
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${p.is_admin ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p.is_admin ? 'admin' : 'member'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.billable ? 'yes' : 'free'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Read-only for now. Next: edit roles, per-deal user assignment (grant edit on a deal), the Analysis-checks
        catalog, and self-learning benchmarks.
      </p>
    </main>
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
