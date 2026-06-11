import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/supabase/admin';

/**
 * Admin-only operations that need the service role (bypass RLS / auth-admin API). Every call
 * verifies the caller is an admin first.
 *
 * GET → list users (profiles merged with auth status: confirmed, deactivated/banned).
 *
 * POST actions:
 *  - set-role     { userId, isAdmin }       → profiles.is_admin
 *  - set-billable { userId, billable }      → profiles.billable
 *  - deactivate   { userId }                → auth ban (can't sign in; data kept)
 *  - reactivate   { userId }                → lift the ban
 *  - delete-user  { userId }                → remove auth user + profile (email can sign up fresh)
 *  - assign-deal  { dealId, userId, role? } → upsert deal_members (default editor)
 *  - unassign-deal{ dealId, userId }        → delete deal_members
 */
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  const sb = serviceClient();
  try {
    const [{ data: profs, error: pErr }, { data: authList, error: aErr }] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,is_admin,billable,created_at').order('created_at'),
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (pErr) throw pErr;
    if (aErr) throw aErr;
    const authById = new Map((authList?.users ?? []).map((u) => [u.id, u]));
    const users = (profs ?? []).map((p) => {
      const au = authById.get(p.id) as { banned_until?: string | null; email_confirmed_at?: string | null } | undefined;
      const bannedUntil = au?.banned_until ? new Date(au.banned_until) : null;
      return {
        ...p,
        confirmed: !!au?.email_confirmed_at,
        deactivated: !!bannedUntil && bannedUntil > new Date(),
      };
    });
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as string;
  const sb = serviceClient();

  try {
    switch (action) {
      case 'set-role': {
        const { userId, isAdmin } = body as { userId?: string; isAdmin?: boolean };
        if (!userId) return bad('userId required');
        const { error } = await sb.from('profiles').update({ is_admin: !!isAdmin }).eq('id', userId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'set-billable': {
        const { userId, billable } = body as { userId?: string; billable?: boolean };
        if (!userId) return bad('userId required');
        const { error } = await sb.from('profiles').update({ billable: !!billable }).eq('id', userId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'set-setting': {
        const { key, value } = body as { key?: string; value?: unknown };
        if (!key) return bad('key required');
        const { error } = await sb.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() } as never);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'deactivate': {
        const { userId } = body as { userId?: string };
        if (!userId) return bad('userId required');
        if (userId === adminId) return bad('You cannot deactivate yourself');
        const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: '87600h' }); // ~10 years
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'reactivate': {
        const { userId } = body as { userId?: string };
        if (!userId) return bad('userId required');
        const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: 'none' });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'delete-user': {
        const { userId } = body as { userId?: string };
        if (!userId) return bad('userId required');
        if (userId === adminId) return bad('You cannot delete yourself');
        const { error } = await sb.auth.admin.deleteUser(userId);
        if (error) throw error;
        await sb.from('profiles').delete().eq('id', userId); // in case the FK doesn't cascade
        return NextResponse.json({ ok: true });
      }
      case 'assign-deal': {
        const { dealId, userId, role } = body as { dealId?: string; userId?: string; role?: string };
        if (!dealId || !userId) return bad('dealId and userId required');
        const memberRole = role === 'viewer' ? 'viewer' : 'editor';
        const { error } = await sb
          .from('deal_members')
          .upsert({ deal_id: dealId, user_id: userId, role: memberRole, granted_by: adminId }, { onConflict: 'deal_id,user_id' });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'unassign-deal': {
        const { dealId, userId } = body as { dealId?: string; userId?: string };
        if (!dealId || !userId) return bad('dealId and userId required');
        const { error } = await sb.from('deal_members').delete().eq('deal_id', dealId).eq('user_id', userId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      default:
        return bad(`Unknown action: ${action}`);
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}
