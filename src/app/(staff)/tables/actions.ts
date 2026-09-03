"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type TableStatus = "available" | "occupied" | "reserved";

export async function updateTableStatus(
  tableId: string,
  status: TableStatus
): Promise<{ error?: string }> {
  const supabase = createClient();

  const { data: adminId, error: adminIdError } = await supabase.rpc(
    "get_my_admin_id"
  );

  if (adminIdError || !adminId) {
    return { error: "Not authorized." };
  }

  const { error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", tableId)
    .eq("admin_id", adminId);

  if (error) return { error: "Failed to update table status." };

  revalidatePath("/tables");
  revalidatePath("/tables/manage");
  revalidatePath("/pos");
  return {};
}
