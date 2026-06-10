import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from './server';
import { SUPABASE_URL } from './config';

/**
 * Service-role client — bypasses RLS. SERVER-ONLY, never expose to the browser.
 * Used by admin route handlers after the caller is verified as an admin.
 */
export function serviceClient() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Supabase service role not configured');
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verify the current request is from a signed-in admin. Server-side getUser works fine
 * (it's only the browser getSession/getUser that hang — see token.ts notes). Returns the
 * admin's user id, or null if not authenticated / not an admin.
 */
export async function requireAdmin(): Promise<string | null> {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? user.id : null;
}
