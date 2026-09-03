"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type KdsStatus = "pending" | "preparing" | "ready";

export async function advanceTicket(
  ticketId: string,
  orderId: string,
  currentStatus: KdsStatus
): Promise<{ error?: string }> {
  const supabase = createClient();

  if (currentStatus === "pending") {
    // pending → preparing: just update the ticket status.
    const { error } = await supabase
      .from("kds_tickets")
      .update({ status: "preparing" })
      .eq("id", ticketId);

    if (error) return { error: "Failed to update ticket." };
    revalidatePath("/kds");
    return {};
  }

  if (currentStatus === "preparing") {
    // preparing → ready: call complete_order() which atomically validates
    // stock, decrements quantities, marks the order as completed, and sets
    // the KDS ticket to 'ready'.
    const { error } = await supabase.rpc("complete_order", {
      p_order_id: orderId,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.toLowerCase().includes("insufficient stock")) {
        return {
          error:
            "Insufficient stock for one or more items in this order.",
        };
      }
      return { error: "Failed to complete order. " + msg };
    }

    revalidatePath("/kds");
    revalidatePath("/orders");
    revalidatePath("/pos");
    revalidatePath("/tables");
    return {};
  }

  return {};
}
