import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MenuPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: categoryCount }, { count: productCount }] = await Promise.all([
    supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", user.id),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", user.id),
  ]);

  const cards = [
    {
      href: "/menu/categories",
      title: "Categories",
      count: categoryCount ?? 0,
      description: "Organize your menu into sections for faster staff browsing and cleaner reporting.",
      accent: "#0EA5E9",
    },
    {
      href: "/menu/products",
      title: "Products",
      count: productCount ?? 0,
      description: "Manage product pricing, stock, and availability for your live POS catalog.",
      accent: "#10B981",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Menu Management</h1>
        <p className="text-sm text-slate-500">
          Set up categories and products for your business. Everything here is scoped to your store only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{card.title}</p>
                <p className="mt-3 text-4xl font-bold text-slate-800">{card.count}</p>
              </div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${card.accent}18`, color: card.accent }}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-500">{card.description}</p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0EA5E9]">
              Open {card.title.toLowerCase()}
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
