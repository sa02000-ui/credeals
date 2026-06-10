import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/supabase/admin';

/**
 * Admin-only mutations that need to bypass RLS (profiles UPDATE is own-only; deal_members
 * insert needs to act as the grantor). Every action verifies the caller is an admin first.
 *
 * Actions:
 *  - set-role     { userId, isAdmin }       → profiles.is_admin
 *  - set-billable { userId, billable }      → profiles.billable
 *  - assign-deal  { dealId, userId, role? } → upsert deal_members (default editor)
 *  - unassign-deal{ dealId, userId }        → delete deal_members
 */
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
