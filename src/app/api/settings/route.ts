import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/admin';

/** Only these keys are ever exposed to the public — app_settings may hold other config that must
 *  not leak through this unauthenticated endpoint. */
export const PUBLIC_SETTING_KEYS = ['gameEnabled'] as const;
const isPublicKey = (k: string): boolean => (PUBLIC_SETTING_KEYS as readonly string[]).includes(k);

/** Public, non-sensitive feature flags (e.g. is game mode visible at all). */
export async function GET() {
  const settings: Record<string, unknown> = { gameEnabled: true };
  try {
    const sb = serviceClient();
    const { data, error } = await sb.from('app_settings').select('key,value');
    if (!error && data) {
      data.filter((r: { key: string }) => isPublicKey(r.key)).forEach((r: { key: string; value: unknown }) => (settings[r.key] = r.value));
      return NextResponse.json({ ok: true, settings });
    }
    // app_settings missing (migration 0003 not run) → read the fallback row in scenarios
    const { data: row } = await sb.from('scenarios').select('steps').eq('id', '__settings__').maybeSingle();
    const stored = ((row as { steps?: Record<string, unknown> } | null)?.steps) ?? {};
    for (const [k, v] of Object.entries(stored)) if (isPublicKey(k)) settings[k] = v;
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: true, settings });
  }
}
