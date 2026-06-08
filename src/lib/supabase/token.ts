'use client';

import { SUPABASE_URL } from './config';

/**
 * Read the Supabase auth session straight from the cookie (set by the server via @supabase/ssr).
 *
 * We do this because supabase-js's own getSession()/getUser() can hang when initializing the
 * session from cookie storage on a fresh page load. Reading the token ourselves and feeding it to
 * the data client via the `accessToken` option is reliable across browsers.
 */
function projectRef(): string {
  try {
    return new URL(SUPABASE_URL ?? '').hostname.split('.')[0];
  } catch {
    return '';
  }
}

interface CookieSession {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  expSeconds?: number;
}

export function readCookieSession(): CookieSession | null {
  if (typeof document === 'undefined') return null;
  const ref = projectRef();
  if (!ref) return null;
  const base = `sb-${ref}-auth-token`;
  const all = document.cookie.split(';').map((c) => c.trim());

  let raw = '';
  const single = all.find((c) => c.startsWith(base + '='));
  if (single) {
    raw = single.slice(base.length + 1);
  } else {
    // chunked across base.0, base.1, ...
    const parts = all
      .filter((c) => c.startsWith(base + '.'))
      .sort((a, b) => a.localeCompare(b))
      .map((c) => c.slice(c.indexOf('=') + 1));
    raw = parts.join('');
  }
  if (!raw) return null;

  let val = decodeURIComponent(raw);
  if (val.startsWith('base64-')) {
    try {
      val = atob(val.slice(7));
    } catch {
      return null;
    }
  }

  let session: { access_token?: string; refresh_token?: string };
  try {
    session = JSON.parse(val);
  } catch {
    return null;
  }
  const accessToken = session.access_token;
  if (!accessToken) return null;

  let userId = '';
  let email: string | undefined;
  let expSeconds: number | undefined;
  try {
    const payload = JSON.parse(
      atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    userId = payload.sub;
    email = payload.email;
    expSeconds = payload.exp;
  } catch {
    /* ignore */
  }
  if (!userId) return null;
  return { accessToken, refreshToken: session.refresh_token, userId, email, expSeconds };
}
