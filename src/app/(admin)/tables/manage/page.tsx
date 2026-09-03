import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTable, deleteTableConfig, updateTableConfig } from "./actions";

type ManageTablesPageProps = {
  searchParams?: {
    error?: string;
  };
};

type TableRecord = {
  id: string;
  name: string;
  capacity: number | null;
  shape: "square" | "rectangle" | "round";
  area_name: string | null;
  row_position: number;
  column_position: number;
  status: "available" | "occupied" | "reserved";
  created_at: string;
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </p>
  );
}

const SHAPES = [
  { value: "square", label: "Square" },
  { value: "rectangle", label: "Rectangle" },
  { value: "round", label: "Round" },
] as const;

export default async function ManageTablesPage({ searchParams }: ManageTablesPageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin) redirect("/login");

  const { data: tablesData } = await supabase
    .from("tables")
    .select("id, name, capacity, shape, area_name, row_position, column_position, status, created_at")
    .eq("admin_id", user.id)
    .order("row_position", { ascending: true })
    .order("column_position", { ascending: true })
    .order("name", { ascending: true });

  const tables = (tablesData ?? []) as TableRecord[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Table Configuration</h1>
          <p className="text-sm text-slate-500">
            Configure your restaurant floor in a practical form-based way. The live floor view uses these saved settings.
          </p>
        </div>
        <Link href="/tables" className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7]">
          Back to live tables
        </Link>
      </div>

      {searchParams?.error ? <ErrorBanner message={searchParams.error} /> : null}

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-800">Add table</h2>
          <p className="text-sm text-slate-500">Set the label, capacity, shape, area, and simple grid location.</p>
        </div>

        <form action={createTable} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <input
            name="name"
            type="text"
            required
            placeholder="Table label or number"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <input
            name="capacity"
            type="number"
            min="1"
            placeholder="Capacity"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <select
            name="shape"
            defaultValue="square"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          >
            {SHAPES.map((shape) => (
              <option key={shape.value} value={shape.value}>
                {shape.label}
              </option>
            ))}
          </select>
          <input
            name="areaName"
            type="text"
            placeholder="Section / area name"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <input
            name="rowPosition"
            type="number"
            min="0"
            defaultValue={0}
            placeholder="Row"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <input
            name="columnPosition"
            type="number"
            min="0"
            defaultValue={0}
            placeholder="Column"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0EA5E9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] xl:col-span-3"
          >
            Add table
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Configured tables</h2>
          <p className="text-sm text-slate-500">Each table keeps its live status while you adjust its configuration.</p>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No tables configured yet. Add your first table above.
          </div>
        ) : (
          tables.map((table) => (
            <div key={table.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <form action={updateTableConfig} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <input type="hidden" name="id" value={table.id} />
                <input
                  name="name"
                  type="text"
                  defaultValue={table.name}
                  required
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                />
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  defaultValue={table.capacity ?? ""}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                />
                <select
                  name="shape"
                  defaultValue={table.shape}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {SHAPES.map((shape) => (
                    <option key={shape.value} value={shape.value}>
                      {shape.label}
                    </option>
                  ))}
                </select>
                <input
                  name="areaName"
                  type="text"
                  defaultValue={table.area_name ?? ""}
                  placeholder="Section / area name"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                />
                <input
                  name="rowPosition"
                  type="number"
                  min="0"
                  defaultValue={table.row_position}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                />
                <input
                  name="columnPosition"
                  type="number"
                  min="0"
                  defaultValue={table.column_position}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                />

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 xl:col-span-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                      {table.status}
                    </span>
                    <span>
                      Created {new Date(table.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>

              <form action={deleteTableConfig} className="mt-3 flex justify-end border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={table.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  Delete table
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
