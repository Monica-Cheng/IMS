"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function updateStaffStatus(formData: FormData, status: "active" | "suspended") {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const staffId = formData.get("staffId");

  if (typeof staffId !== "string" || !staffId) {
    return;
  }

  await supabase
    .from("staff")
    .update({ status })
    .eq("id", staffId)
    .eq("admin_id", user.id);

  revalidatePath("/staff");
}

export async function approveStaff(formData: FormData) {
  await updateStaffStatus(formData, "active");
}

export async function suspendStaff(formData: FormData) {
  await updateStaffStatus(formData, "suspended");
}

export async function reactivateStaff(formData: FormData) {
  await updateStaffStatus(formData, "active");
}
