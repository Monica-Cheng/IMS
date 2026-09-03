"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureAdminProfile } from "@/lib/supabase/admins";
import { redirect } from "next/navigation";

export type AuthState = {
  error: string | null;
  message?: string | null;
};

// ---------------------------------------------------------------------------
// login
// Shared sign-in for both admins and staff:
//   admin row found          → /dashboard
//   active staff row found   → /pos
//   pending/suspended staff  → sign out + return error
//   no matching role row     → sign out + return error
// ---------------------------------------------------------------------------
export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Invalid email or password." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication failed. Please try again." };
  }

  // Check admin first
  const { data: adminRow, error: adminQueryError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (adminQueryError) {
    await supabase.auth.signOut();
    return { error: "Login failed. Please try again." };
  }

  if (adminRow) {
    redirect("/dashboard");
  }

  if (user.user_metadata?.role === "admin") {
    const ensuredAdmin = await ensureAdminProfile(supabase, user);

    if (ensuredAdmin.ok) {
      redirect("/dashboard");
    }

    await supabase.auth.signOut();
    return { error: "Your admin account setup is incomplete. Please try signing up again." };
  }

  // Check staff
  const { data: staffRow, error: staffQueryError } = await supabase
    .from("staff")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (staffQueryError) {
    await supabase.auth.signOut();
    return { error: "Login failed. Please try again." };
  }

  if (!staffRow) {
    await supabase.auth.signOut();
    return {
      error: "No account found. Ask your manager to create your staff account.",
    };
  }

  if (staffRow.status === "pending") {
    await supabase.auth.signOut();
    return { error: "Your account is pending approval. Contact your manager." };
  }

  if (staffRow.status === "suspended") {
    await supabase.auth.signOut();
    return { error: "Your account has been suspended. Contact your manager." };
  }

  if (staffRow.status !== "active") {
    await supabase.auth.signOut();
    return { error: "You do not have permission to log in." };
  }

  redirect("/pos");
}

// ---------------------------------------------------------------------------
// registerAdmin
// Creates a Supabase auth user and an admins row with a generated unique
// business_code. Redirects to /dashboard on success.
// ---------------------------------------------------------------------------
export async function registerAdmin(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = createClient();

  const name  = (formData.get("name")  as string).trim();
  const email = (formData.get("email") as string).trim();
  const password = formData.get("password") as string;

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: "admin", name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!data.user) {
    return { error: "Registration failed. Please try again." };
  }

  if (!data.session) {
    return {
      error: null,
      message: "Check your email for a confirmation link to finish creating your admin account.",
    };
  }

  const ensuredAdmin = await ensureAdminProfile(supabase, data.user);

  if (!ensuredAdmin.ok) {
    await supabase.auth.signOut();
    return { error: "Failed to create your admin account. Please try again." };
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// registerStaff
// Creates a Supabase auth user and a staff row (status: pending) linked to
// the admin identified by the business code. Does NOT redirect to any
// protected page — shows a pending-approval message instead.
// ---------------------------------------------------------------------------
export async function registerStaff(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = createClient();

  const name         = (formData.get("name")         as string).trim();
  const email        = (formData.get("email")        as string).trim();
  const password     =  formData.get("password")     as string;
  const businessCode = (formData.get("businessCode") as string).trim().toUpperCase();

  const { data: businessCodeExists, error: adminLookupError } = await supabase.rpc(
    "business_code_exists",
    { p_business_code: businessCode }
  );

  if (adminLookupError) {
    return { error: "Unable to validate that business code right now. Please try again." };
  }

  if (!businessCodeExists) {
    return { error: "Invalid business code. Ask your manager for the correct code." };
  }

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: "staff", name, business_code: businessCode },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!data.user) {
    return { error: "Registration failed. Please try again." };
  }

  if (!data.session) {
    return {
      error: null,
      message:
        "Check your email to confirm your account. After confirmation, your account will stay pending until your manager approves it.",
    };
  }

  // Call the SECURITY DEFINER RPC to create the staff row immediately.
  const { error: rpcError } = await supabase.rpc("register_staff", {
    p_business_code: businessCode,
    p_name:          name,
    p_email:         email,
  });

  // Sign out regardless — staff must wait for manager approval before logging in.
  await supabase.auth.signOut();

  if (rpcError) {
    // The most likely cause is an invalid business code.
    return { error: rpcError.message };
  }

  return {
    error: null,
    message: "Account created. Your manager needs to approve your account before you can log in.",
  };
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
