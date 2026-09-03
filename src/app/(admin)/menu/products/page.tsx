import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  adjustProductStock,
  createProduct,
  toggleProductAvailability,
  updateProduct,
} from "../actions";

type ProductsPageProps = {
  searchParams?: {
    error?: string;
  };
};

type CategoryOption = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  is_available: boolean;
  image_url: string | null;
  created_at: string;
  category_id: string;
  categories: { name: string } | null;
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </p>
  );
}

function AvailabilityBadge({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        available
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
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
      .select("id, name, description, price, stock, is_available, image_url, created_at, category_id, categories(name)")
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

      {searchParams?.error ? <ErrorBanner message={searchParams.error} /> : null}

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-800">Add product</h2>
          <p className="text-sm text-slate-500">Add products to categories that belong to your business.</p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Create at least one category before adding products.
          </div>
        ) : (
          <form action={createProduct} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <input
              name="name"
              type="text"
              required
              placeholder="Product name"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
            <select
              name="categoryId"
              required
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
            >
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <textarea
              name="description"
              rows={3}
              placeholder="Optional description"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 xl:col-span-2"
            />
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Price"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
            <input
              name="stock"
              type="number"
              min="0"
              required
              defaultValue={0}
              placeholder="Stock quantity"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
            <input
              name="imageUrl"
              type="url"
              placeholder="Optional image URL"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 xl:col-span-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#0EA5E9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] xl:col-span-2"
            >
              Add product
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Your products</h2>
          <p className="text-sm text-slate-500">Adjust stock inline and toggle availability instantly.</p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No products yet. Add your first product above.
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{product.name}</h3>
                  <p className="text-sm text-slate-500">{product.categories?.name ?? "Uncategorized"}</p>
                </div>
                <AvailabilityBadge available={product.is_available} />
              </div>

              <form action={updateProduct} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <input type="hidden" name="id" value={product.id} />
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Product name</label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={product.name}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Category</label>
                  <select
                    name="categoryId"
                    defaultValue={product.category_id}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={product.description ?? ""}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Price</label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={product.price}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Current stock</label>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    defaultValue={product.stock}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Image URL</label>
                  <input
                    name="imageUrl"
                    type="url"
                    defaultValue={product.image_url ?? ""}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div className="flex flex-wrap gap-2 xl:col-span-2">
                  <button
                    type="submit"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Save changes
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>
                    Added {new Date(product.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="hidden text-slate-300 xl:inline">•</span>
                  <span>Price ${product.price.toFixed(2)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={adjustProductStock} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={product.id} />
                    <input
                      name="delta"
                      type="number"
                      defaultValue={1}
                      className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                    />
                    <button
                      type="submit"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      Adjust stock
                    </button>
                  </form>

                  <form action={toggleProductAvailability}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="nextValue" value={product.is_available ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        product.is_available
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      }`}
                    >
                      {product.is_available ? "Turn off availability" : "Turn on availability"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
