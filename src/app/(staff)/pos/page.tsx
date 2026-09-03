import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import POSClient from "./POSClient";

export default async function POSPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminId } = await supabase.rpc("get_my_admin_id");
  if (!adminId) redirect("/login");

  // Fetch categories ordered by sort_order, then alphabetically.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("admin_id", adminId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  // Only show products that are marked available and have stock remaining.
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, description, image_url, stock, category_id")
    .eq("admin_id", adminId)
    .eq("is_available", true)
    .gt("stock", 0)
    .order("name", { ascending: true });

  // Only available tables are offered for dine-in selection.
  const { data: tables } = await supabase
    .from("tables")
    .select("id, name, capacity")
    .eq("admin_id", adminId)
    .eq("status", "available")
    .order("name", { ascending: true });

  return (
    <POSClient
      categories={categories ?? []}
      products={products ?? []}
      tables={tables ?? []}
    />
  );
}
