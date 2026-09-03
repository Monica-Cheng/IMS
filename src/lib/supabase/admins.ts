import type { SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";
import type { Database } from "./types";

type AdminAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type EnsureAdminProfileResult =
  | { ok: true }
  | { ok: false; reason: "missing_email" | "insert_failed"; message: string };

export type AdminProfile = {
  name: string | null;
  email: string;
  business_name: string | null;
  business_code: string | null;
};

const BUSINESS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BUSINESS_CODE_LENGTH = 8;
const MAX_BUSINESS_CODE_ATTEMPTS = 10;

function getAdminName(user: AdminAuthUser) {
  const name = user.user_metadata?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function generateBusinessCode() {
  let code = "";

  for (let i = 0; i < BUSINESS_CODE_LENGTH; i += 1) {
    code += BUSINESS_CODE_ALPHABET[randomInt(0, BUSINESS_CODE_ALPHABET.length)];
  }

  return code;
}

function isBusinessCodeCollision(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" &&
    typeof error.message === "string" &&
    error.message.includes("business_code")
  );
}

function isSchemaFallbackCandidate(error: { message?: string }) {
  return (
    typeof error.message === "string" &&
    (error.message.includes("business_code") || error.message.includes("name"))
  );
}

export async function ensureAdminProfile(
  supabase: SupabaseClient<Database>,
  user: AdminAuthUser
): Promise<EnsureAdminProfileResult> {
  if (!user.email) {
    return {
      ok: false,
      reason: "missing_email",
      message: "Missing email address for this admin account.",
    };
  }

  const name = getAdminName(user);
  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingAdminError) {
    return {
      ok: false,
      reason: "insert_failed",
      message: existingAdminError.message,
    };
  }

  if (existingAdmin) {
    return { ok: true };
  }

  for (let attempt = 0; attempt < MAX_BUSINESS_CODE_ATTEMPTS; attempt += 1) {
    const businessCode = generateBusinessCode();

    const { error: insertError } = await supabase.from("admins").insert({
      id: user.id,
      email: user.email,
      name,
      business_code: businessCode,
    });

    if (!insertError) {
      return { ok: true };
    }

    if (isBusinessCodeCollision(insertError)) {
      continue;
    }

    if (isSchemaFallbackCandidate(insertError)) {
      const { error: legacyInsertError } = await supabase.from("admins").insert({
        id: user.id,
        email: user.email,
        business_name: name,
      });

      if (!legacyInsertError) {
        return { ok: true };
      }

      return {
        ok: false,
        reason: "insert_failed",
        message: legacyInsertError.message,
      };
    }

    return {
      ok: false,
      reason: "insert_failed",
      message: insertError.message,
    };
  }

  return {
    ok: false,
    reason: "insert_failed",
    message: "Failed to generate a unique business code for this admin account.",
  };
}

export async function getAdminProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AdminProfile | null> {
  const { data: adminProfile, error: profileError } = await supabase
    .from("admins")
    .select("name, email, business_name, business_code")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && adminProfile) {
    return adminProfile;
  }

  const { data: legacyProfile, error: legacyError } = await supabase
    .from("admins")
    .select("email, business_name")
    .eq("id", userId)
    .maybeSingle();

  if (!legacyError && legacyProfile) {
    return {
      name: null,
      email: legacyProfile.email,
      business_name: legacyProfile.business_name,
      business_code: null,
    };
  }

  return null;
}
