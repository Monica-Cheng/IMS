import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/supabase/admins";
import Sidebar from "@/components/Sidebar";

type ActiveStaffProfile = {
  name: string;
  email: string;
  business_name: string | null;
};

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await getAdminProfile(supabase, user.id);

  if (admin) {
    return (
      <div className="flex h-screen bg-[#EFF6FF] overflow-hidden">
        <Sidebar user={admin} role="admin" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    );
  }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("name, email, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!staffRow || staffRow.status !== "active") {
    redirect("/login");
  }

  const staffUser: ActiveStaffProfile = {
    name: staffRow.name,
    email: staffRow.email,
    business_name: null,
  };

  return (
    <div className="flex h-screen bg-[#EFF6FF] overflow-hidden">
      <Sidebar user={staffUser} role="staff" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
