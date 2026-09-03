import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/supabase/admins";
import TablesClient from "./TablesClient";

export default async function TablesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminProfile = await getAdminProfile(supabase, user.id);
  const isAdmin = !!adminProfile;

  const { data: adminId } = await supabase.rpc("get_my_admin_id");
  if (!adminId) redirect("/login");

  const { data: tables } = await supabase
    .from("tables")
    .select("id, name, capacity, status, shape, area_name, row_position, column_position")
    .eq("admin_id", adminId)
    .order("row_position", { ascending: true })
    .order("column_position", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Tables</h1>
          <p className="text-sm text-slate-500">
            Live floor view for table status and dine-in operations.
          </p>
        </div>
        {isAdmin ? (
          <Link
            href="/tables/manage"
            className="rounded-xl bg-[#0EA5E9] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7]"
          >
            Configure tables
          </Link>
        ) : null}
      </div>

      <TablesClient initialTables={tables ?? []} canManageTables={isAdmin} />
    </div>
  );
}
