import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductsClient from "./ProductsClient";

type CategoryOption = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  stock: number;
  is_available: boolean;
  image_url: string | null;
  created_at: string;
  category_id: string;
  categories: { name: string } | null;
};

export default async function ProductsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [categoriesData, productsData] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("admin_id", user.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, description, price, cost_price, stock, is_available, image_url, created_at, category_id, categories(name)")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const categories = (categoriesData.data ?? []) as CategoryOption[];
  const products = (productsData.data ?? []) as ProductRow[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Products</h1>
          <p className="text-sm text-slate-500">
            Manage pricing, stock, and availability for the products shown in your POS.
          </p>
        </div>
        <Link href="/menu/categories" className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7]">
          Manage categories
        </Link>
      </div>

      <ProductsClient categories={categories} products={products} />
    </div>
  );
}
