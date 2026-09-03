import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Admin-only routes
const ADMIN_ROUTES = [
  "/dashboard",
  "/menu",
  "/reports",
  "/staff",
  "/settings",
  "/tables/manage",
];

// Routes for staff + admins
const STAFF_ROUTES = ["/pos", "/tables", "/kds", "/orders"];

// Auth pages — authenticated users should be redirected away from these
const AUTH_ROUTES = ["/login", "/register"];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdminRoute = matchesRoute(pathname, ADMIN_ROUTES);
  const isStaffRoute = matchesRoute(pathname, STAFF_ROUTES);
  const isAuthRoute  = matchesRoute(pathname, AUTH_ROUTES);

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!user) {
    if (isAdminRoute || isStaffRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ── Authenticated — determine role with a single PK lookup ────────────────
  // admins.id is a PK, so this is always an indexed point-read.
  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !!adminRow;

  // Resolve staff row only when needed (non-admin on a protected route or auth page)
  let isActiveStaff = false;
  if (!isAdmin && (isAdminRoute || isStaffRoute || isAuthRoute)) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle();
    isActiveStaff =
      (staffRow as { status: string } | null)?.status === "active";
  }

  // ── Redirect authenticated users away from /login and /register ───────────
  if (isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/dashboard" : isActiveStaff ? "/pos" : "/login";
    // If neither admin nor active staff (orphaned auth user), leave on login
    if (url.pathname !== "/login") {
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ── Admin-only route guard ─────────────────────────────────────────────────
  if (isAdminRoute && !isAdmin) {
    const url = request.nextUrl.clone();
    // Active staff land on /pos; anyone else goes to /login
    url.pathname = isActiveStaff ? "/pos" : "/login";
    return NextResponse.redirect(url);
  }

  // ── Staff route guard ──────────────────────────────────────────────────────
  if (isStaffRoute && !isAdmin && !isActiveStaff) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
