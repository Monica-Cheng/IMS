import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/supabase/admins";
import CopyBusinessCodeButton from "@/components/CopyBusinessCodeButton";
import { approveStaff, reactivateStaff, suspendStaff } from "./actions";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

type StaffRecord = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "active" | "suspended";
  created_at: string;
};

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-800">No staff accounts yet</h2>
      <p className="mt-2 text-sm text-slate-500">
        Share your business code with staff so they can create an account. New accounts will appear here for approval.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: StaffRecord["status"] }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function StaffAction({ staffId, action, label }: { staffId: string; action: (formData: FormData) => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="staffId" value={staffId} />
      <button
        type="submit"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        {label}
      </button>
    </form>
  );
}

function StaffRow({ member }: { member: StaffRecord }) {
  const createdDate = new Date(member.created_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-slate-800">{member.name}</h3>
          <StatusBadge status={member.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{member.email}</p>
        <p className="mt-2 text-xs text-slate-400">Joined {createdDate}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {member.status === "pending" && <StaffAction staffId={member.id} action={approveStaff} label="Approve" />}
        {member.status === "active" && <StaffAction staffId={member.id} action={suspendStaff} label="Suspend" />}
        {member.status === "suspended" && <StaffAction staffId={member.id} action={reactivateStaff} label="Re-activate" />}
      </div>
    </div>
  );
}

export default async function StaffPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = await getAdminProfile(supabase, user.id);

  if (!admin) {
    redirect("/login");
  }

  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, name, email, status, created_at")
    .eq("admin_id", user.id)
    .order("created_at", { ascending: false });

  const staff = (staffRows ?? []) as StaffRecord[];
  const pendingCount = staff.filter((member) => member.status === "pending").length;
  const activeCount = staff.filter((member) => member.status === "active").length;
  const suspendedCount = staff.filter((member) => member.status === "suspended").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Staff</h1>
        <p className="text-sm text-slate-500">
          Share your business code with staff so they can register, then approve them here before they can sign in.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Business code</p>
            <div className="mt-3 inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-2xl font-bold tracking-[0.35em] text-[#1E3A5F]">
                {admin.business_code ?? "Unavailable"}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Staff enter this 8-character code during account creation. Their account will stay pending until you approve it.
            </p>
          </div>

          {admin.business_code ? (
            <CopyBusinessCodeButton code={admin.business_code} />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Your business code is not available yet. Refresh after your admin profile finishes syncing.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending approval</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active staff</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Suspended staff</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">{suspendedCount}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Team members</h2>
          <p className="text-sm text-slate-500">Approve pending staff to grant POS access. Suspended staff will be blocked from signing in.</p>
        </div>

        {staff.length === 0 ? <EmptyState /> : staff.map((member) => <StaffRow key={member.id} member={member} />)}
      </section>
    </div>
  );
}
