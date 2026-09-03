"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

function backToManage(error?: string) {
  redirect(error ? `/tables/manage?error=${encodeURIComponent(error)}` : "/tables/manage");
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createTable(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const capacity = parseInteger(formData.get("capacity"), 0);
  const shape = String(formData.get("shape") ?? "square");
  const areaName = String(formData.get("areaName") ?? "").trim();
  const rowPosition = parseInteger(formData.get("rowPosition"), 0);
  const columnPosition = parseInteger(formData.get("columnPosition"), 0);

  if (!name) backToManage("Table label is required.");

  const { error } = await supabase.from("tables").insert({
    admin_id: user.id,
    name,
    capacity: capacity > 0 ? capacity : null,
    shape: shape as "square" | "rectangle" | "round",
    area_name: areaName || null,
    row_position: rowPosition,
    column_position: columnPosition,
  });

  if (error) backToManage("Failed to add table.");

  revalidatePath("/tables");
  revalidatePath("/tables/manage");
  redirect("/tables/manage");
}

export async function updateTableConfig(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = parseInteger(formData.get("capacity"), 0);
  const shape = String(formData.get("shape") ?? "square");
  const areaName = String(formData.get("areaName") ?? "").trim();
  const rowPosition = parseInteger(formData.get("rowPosition"), 0);
  const columnPosition = parseInteger(formData.get("columnPosition"), 0);

  if (!id || !name) backToManage("Table update is missing required data.");

  const { error } = await supabase
    .from("tables")
    .update({
      name,
      capacity: capacity > 0 ? capacity : null,
      shape: shape as "square" | "rectangle" | "round",
      area_name: areaName || null,
      row_position: rowPosition,
      column_position: columnPosition,
    })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) backToManage("Failed to update table.");

  revalidatePath("/tables");
  revalidatePath("/tables/manage");
  redirect("/tables/manage");
}

export async function deleteTableConfig(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (!id) backToManage("Table deletion is missing required data.");

  const { error } = await supabase
    .from("tables")
    .delete()
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) backToManage("Failed to delete table.");

  revalidatePath("/tables");
  revalidatePath("/tables/manage");
  redirect("/tables/manage");
}
