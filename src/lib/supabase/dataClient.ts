'use client';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { readCookieSession } from './token';

/**
 * Data client for DB reads/writes. Uses the `accessToken` option (3rd-party-auth mode): every
 * request carries the user's JWT read from the cookie, and supabase-js's own session/lock
 * machinery is disabled — which avoids the getSession() hang on fresh loads. RLS still applies.
 */
let dc: ReturnType<typeof createSupabaseClient> | undefined;

export function dataClient() {
  if (!dc) {
    dc = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      accessToken: async () => readCookieSession()?.accessToken ?? null,
    });
  }
  return dc;
}
