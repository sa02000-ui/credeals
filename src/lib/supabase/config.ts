// credeals uses distinctly-named env vars (NEXT_PUBLIC_SB_*) so it never collides with the
// machine-global NEXT_PUBLIC_SUPABASE_* vars used by the separate am-portal project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SB_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SB_ANON_KEY;

/** True only when credeals' own Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
