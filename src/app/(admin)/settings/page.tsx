import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BusinessSettingsForm from "./BusinessSettingsForm";

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("business_name, tax_rate")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage how your business appears and how orders are priced.
        </p>
      </div>

      <BusinessSettingsForm
        businessName={admin.business_name ?? ""}
        taxRate={Number(admin.tax_rate ?? 0)}
      />
    </div>
  );
}
