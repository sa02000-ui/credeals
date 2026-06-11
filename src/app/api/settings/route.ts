import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/admin';

/** Public, non-sensitive feature flags (e.g. is game mode visible at all). */
export async function GET() {
  try {
    const sb = serviceClient();
    const { data, error } = await sb.from('app_settings').select('key,value');
    if (error) throw error;
    const settings: Record<string, unknown> = { gameEnabled: true };
    (data ?? []).forEach((r: { key: string; value: unknown }) => (settings[r.key] = r.value));
    return NextResponse.json({ ok: true, settings });
  } catch {
    // table missing / not configured → default everything on
    return NextResponse.json({ ok: true, settings: { gameEnabled: true } });
  }
}
