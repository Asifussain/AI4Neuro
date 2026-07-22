import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_META, isRole, type Role } from '@/lib/roles';

/**
 * Server-side route protection.
 *
 * Previously a no-op pass-through: every route (including /admin, /super-admin)
 * was fully server-rendered before any auth check ran, with protection living
 * entirely in the client-side withAuth HOC — a defense-in-depth gap, not a
 * live exploit, since the FastAPI backend still authorizes every real data
 * request, but the only thing standing between "cosmetic" and "load-bearing"
 * if that backend check ever had a bug.
 *
 * This checks for a valid Supabase session (getUser(), which round-trips to
 * Supabase to verify the token — not getSession(), which only reads the
 * cookie without verifying it) and, for the five role-prefixed route trees,
 * the caller's role from auth user_metadata — the same fast/non-authoritative
 * signal AuthProvider already uses client-side (set at account-creation time
 * by the backend, see app/services/auth_admin.py). This is not a new trust
 * boundary: real data access is still authorized by the backend on every
 * request regardless of what this middleware decides.
 */

const ROLE_ROUTE_PREFIXES: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_META).map(([role, meta]) => [`/${meta.routeSegment}`, role as Role])
);

const PROTECTED_PREFIXES = [
  ...Object.keys(ROLE_ROUTE_PREFIXES),
  '/analysis',
  '/dashboard',
  '/profile',
  '/change-password',
  '/search',
];

function matchedPrefix(pathname: string, prefixes: string[]): string | null {
  return prefixes.find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? null;
}

function dashboardPathFor(role: Role): string {
  return `/${ROLE_META[role].routeSegment}/dashboard`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPrefix = matchedPrefix(pathname, PROTECTED_PREFIXES);
  if (!protectedPrefix) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredRole = ROLE_ROUTE_PREFIXES[protectedPrefix];
  if (requiredRole) {
    const userRole = user.user_metadata?.role;
    if (!isRole(userRole) || userRole !== requiredRole) {
      const fallback = isRole(userRole) ? dashboardPathFor(userRole) : '/login';
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
