import { createClient } from "@/lib/supabase/server";
import { ensureAdminProfile } from "@/lib/supabase/admins";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Handles the redirect after Supabase email confirmation.
// Supabase redirects to /auth/callback?code=... once the user clicks the link.
// We exchange the code for a session, then branch by role stored in user_metadata:
//   admin → create admin row (if missing) → redirect /dashboard
//   staff → call register_staff RPC → sign out → redirect /login?message=pending
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const role         = data.user.user_metadata?.role as string | undefined;
      const name         = data.user.user_metadata?.name         ?? null;
      const businessCode = data.user.user_metadata?.business_code ?? null;

      if (role === "staff" && businessCode) {
        // Create the staff row, then sign out — they need manager approval.
        await supabase.rpc("register_staff", {
          p_business_code: businessCode,
          p_name:          name ?? "",
          p_email:         data.user.email!,
        });
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?message=pending_approval`);
      }

      // Default: admin path — create or repair the admin row after confirmation.
      const ensuredAdmin = await ensureAdminProfile(supabase, data.user);

      if (!ensuredAdmin.ok) {
        return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
