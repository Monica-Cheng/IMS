"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same discriminated result shape used by the menu product actions, so the UI
// can render inline success/error feedback instead of redirecting.
export type SettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function updateBusinessSettings(
  _prev: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const { supabase, user } = await requireAdmin();

  const businessName = String(formData.get("businessName") ?? "").trim();
  const chargeTax = String(formData.get("chargeTax") ?? "") === "on";
  const rawRate = String(formData.get("taxRate") ?? "").trim();

  if (!businessName) {
    return { ok: false, message: "Business name is required." };
  }

  // Tax is opt-in. With the toggle off we force the stored rate to 0 and ignore
  // whatever was (or wasn't) in the percentage field.
  let taxRate = 0;

  if (chargeTax) {
    if (rawRate === "") {
      return { ok: false, message: "Enter your tax rate, or turn tax off." };
    }

    const parsed = Number(rawRate);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return { ok: false, message: "Tax rate must be a number between 0 and 100." };
    }

    taxRate = parsed;
  }

  const { error } = await supabase
    .from("admins")
    .update({ business_name: businessName, tax_rate: taxRate })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Failed to save settings. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: chargeTax
      ? `Settings saved. Orders will be taxed at ${taxRate}%.`
      : "Settings saved. Tax is off.",
  };
}
