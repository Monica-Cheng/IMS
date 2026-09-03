import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KDSClient from "./KDSClient";

// Supabase nested-select return types
type RawTicket = {
  id: string;
  status: "pending" | "preparing" | "ready";
  created_at: string;
  order_id: string;
  orders: {
    id: string;
    type: "dine-in" | "takeaway";
    notes: string | null;
    tables: { id: string; name: string } | null;
    order_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      products: { id: string; name: string } | null;
    }>;
  } | null;
};

export default async function KDSPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminId } = await supabase.rpc("get_my_admin_id");
  if (!adminId) redirect("/login");

  // Fetch all KDS tickets from the last 24 hours, joining order details.
  // RLS automatically scopes to the current user's org.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rawTickets } = await supabase
    .from("kds_tickets")
    .select(
      `
      id,
      status,
      created_at,
      order_id,
      orders (
        id,
        type,
        notes,
        tables ( id, name ),
        order_items (
          id,
          quantity,
          unit_price,
          products ( id, name )
        )
      )
    `
    )
    .eq("admin_id", adminId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // Normalise into a flat shape the client component can work with.
  const tickets = ((rawTickets ?? []) as unknown as RawTicket[])
    .filter((t) => t.orders !== null)
    .map((t) => ({
      id: t.id,
      status: t.status,
      created_at: t.created_at,
      order_id: t.order_id,
      order_type: t.orders!.type,
      order_notes: t.orders!.notes,
      table_name: t.orders!.tables?.name ?? null,
      items: (t.orders!.order_items ?? []).map((oi) => ({
        id: oi.id,
        quantity: oi.quantity,
        product_name: oi.products?.name ?? "Unknown item",
      })),
    }));

  return <KDSClient initialTickets={tickets} />;
}
