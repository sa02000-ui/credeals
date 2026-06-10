import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * Refresh the Supabase session each request and gate the app behind login.
 * No-op (app stays open) until Supabase is configured.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const path = request.nextUrl.pathname;

  // Email-confirmation / OAuth links sometimes land the PKCE `?code=` on the Site URL root
  // (e.g. https://credeals.io/?code=...) instead of /auth/callback. Route it to the callback so
  // the code is exchanged for a session, regardless of how Supabase composed the link.
  const code = request.nextUrl.searchParams.get('code');
  if (code && !path.startsWith('/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    if (!url.searchParams.get('next')) url.searchParams.set('next', '/app');
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/api/lookup');
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}
