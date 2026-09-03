import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdersClient from "../../(admin)/orders/OrdersClient";

type RawOrder = {
  id: string;
  type: "dine-in" | "takeaway";
  status: string;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  tables: { id: string; name: string } | null;
  payments: Array<{ id: string; method: string; amount: number }>;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products: { id: string; name: string } | null;
  }>;
};

export default async function OrdersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawOrders } = await supabase
    .from("orders")
    .select(
      `
      id,
      type,
      status,
      total_amount,
      created_at,
      completed_at,
      notes,
      tables ( id, name ),
      payments ( id, method, amount ),
      order_items (
        id,
        quantity,
        unit_price,
        products ( id, name )
      )
    `
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(200);

  const orders = ((rawOrders ?? []) as unknown as RawOrder[]).map((o) => ({
    id: o.id,
    type: o.type,
    status: o.status,
    total_amount: o.total_amount,
    created_at: o.created_at,
    completed_at: o.completed_at,
    notes: o.notes,
    table_name: o.tables?.name ?? null,
    payments: o.payments ?? [],
    items: (o.order_items ?? []).map((oi) => ({
      id: oi.id,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      product_name: oi.products?.name ?? "Unknown item",
    })),
  }));

  return <OrdersClient orders={orders} />;
}
