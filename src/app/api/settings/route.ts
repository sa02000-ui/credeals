import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/admin';

/** Public, non-sensitive feature flags (e.g. is game mode visible at all). */
export async function GET() {
  const settings: Record<string, unknown> = { gameEnabled: true };
  try {
    const sb = serviceClient();
    const { data, error } = await sb.from('app_settings').select('key,value');
    if (!error && data) {
      data.forEach((r: { key: string; value: unknown }) => (settings[r.key] = r.value));
      return NextResponse.json({ ok: true, settings });
    }
    // app_settings missing (migration 0003 not run) → read the fallback row in scenarios
    const { data: row } = await sb.from('scenarios').select('steps').eq('id', '__settings__').maybeSingle();
    const stored = ((row as { steps?: Record<string, unknown> } | null)?.steps) ?? {};
    Object.assign(settings, stored);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: true, settings });
  }
}
