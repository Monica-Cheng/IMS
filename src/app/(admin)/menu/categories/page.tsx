import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCategory, deleteCategory, updateCategory } from "../actions";

type CategoriesPageProps = {
  searchParams?: {
    error?: string;
  };
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </p>
  );
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, sort_order, created_at")
    .eq("admin_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const categories = (categoriesData ?? []) as CategoryRow[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Categories</h1>
          <p className="text-sm text-slate-500">
            Create and organize the sections that group your products in the POS.
          </p>
        </div>
        <Link href="/menu/products" className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7]">
          Manage products
        </Link>
      </div>

      {searchParams?.error ? <ErrorBanner message={searchParams.error} /> : null}

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-800">Add category</h2>
          <p className="text-sm text-slate-500">New categories appear immediately in your menu setup.</p>
        </div>

        <form action={createCategory} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_140px_160px]">
          <input
            name="name"
            type="text"
            required
            placeholder="Category name"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <input
            name="sortOrder"
            type="number"
            defaultValue={categories.length}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0EA5E9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7]"
          >
            Add category
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Your categories</h2>
          <p className="text-sm text-slate-500">Deletion is blocked when products are still linked to a category.</p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No categories yet. Add your first category above.
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <form action={updateCategory} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_140px_auto]">
                <input type="hidden" name="id" value={category.id} />
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    Category name
                  </label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={category.name}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    Sort order
                  </label>
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={category.sort_order}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                  <button
                    type="submit"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Save
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <span>
                  Created {new Date(category.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    Delete category
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
