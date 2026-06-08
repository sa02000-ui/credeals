'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Singleton @supabase/ssr browser client — used for AUTH ACTIONS only (sign in / magic link /
// OAuth / sign out), which are direct network calls and work fine. DB reads/writes use the
// separate dataClient (cookie-token based) to avoid the getSession() init hang on fresh loads.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  return client;
}
