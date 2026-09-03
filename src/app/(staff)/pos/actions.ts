"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CheckoutPayload = {
  orderType: "dine-in" | "takeaway";
  tableId?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  paymentMethod: "cash" | "card" | "grabpay" | "paynow" | "wechatpay";
  totalAmount: number;
};

export type CheckoutResult = {
  error?: string;
  orderId?: string;
};

export async function submitOrder(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // get_my_admin_id() resolves to the org's admin ID for both admins and
  // active staff — used for all admin_id columns and RLS checks.
  const { data: adminId, error: adminIdError } = await supabase.rpc(
    "get_my_admin_id"
  );
  if (adminIdError || !adminId) return { error: "Not authorized." };

  // staff_id is set only when the caller is a staff member, not the admin.
  const staffId: string | null = user.id !== adminId ? user.id : null;

  if (!payload.items.length) return { error: "Cart is empty." };
  if (payload.orderType === "dine-in" && !payload.tableId) {
    return { error: "Please select a table for dine-in orders." };
  }

  if (payload.orderType === "dine-in" && payload.tableId) {
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, status")
      .eq("id", payload.tableId)
      .eq("admin_id", adminId)
      .maybeSingle();

    if (tableError || !table) {
      return { error: "Please select a valid configured table for this order." };
    }

    if (table.status !== "available") {
      return { error: "That table is no longer available. Please choose another table." };
    }
  }

  // 1. Create the order as 'pending'. It stays pending until the kitchen
  //    marks the KDS ticket as ready, at which point complete_order() is
  //    called to atomically decrement stock and mark it completed.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      admin_id: adminId,
      staff_id: staffId,
      table_id: payload.tableId ?? null,
      type: payload.orderType,
      status: "pending",
      total_amount: payload.totalAmount,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: "Failed to create the order. Please try again." };
  }

  // 2. Insert all order line items.
  const { error: itemsError } = await supabase.from("order_items").insert(
    payload.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
  );

  if (itemsError) {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    return { error: "Failed to save order items. Please try again." };
  }

  // 3. Create the KDS ticket so the kitchen display picks up the order
  //    immediately in 'pending' state.
  const { error: kdsError } = await supabase
    .from("kds_tickets")
    .insert({ order_id: order.id, admin_id: adminId, status: "pending" });

  if (kdsError) {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    return { error: "Failed to create kitchen ticket. Please try again." };
  }

  // 4. Record the payment upfront (payment is taken at POS before the
  //    kitchen prepares the order).
  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    admin_id: adminId,
    amount: payload.totalAmount,
    method: payload.paymentMethod,
  });

  if (paymentError) {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    return { error: "Failed to record payment. Please try again." };
  }

  // 5. For dine-in orders, mark the table as occupied immediately.
  if (payload.orderType === "dine-in" && payload.tableId) {
    await supabase
      .from("tables")
      .update({ status: "occupied" })
      .eq("id", payload.tableId)
      .eq("admin_id", adminId);
  }

  revalidatePath("/pos");
  revalidatePath("/tables");
  revalidatePath("/kds");
  return { orderId: order.id };
}
