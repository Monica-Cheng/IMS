"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateBusinessSettings, type SettingsActionResult } from "./actions";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400";

// Mirror a server-action result into local state that clears itself after ~4s.
function useEphemeralResult(state: SettingsActionResult | null) {
  const [shown, setShown] = useState<SettingsActionResult | null>(null);

  useEffect(() => {
    if (!state) return;
    setShown(state);
    const timer = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  return shown;
}

function ActionFeedback({ result }: { result: SettingsActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {result.message}
    </p>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-xl bg-[#0EA5E9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function BusinessSettingsForm({
  businessName,
  taxRate,
}: {
  businessName: string;
  taxRate: number;
}) {
  const [state, formAction] = useFormState(updateBusinessSettings, null);
  const result = useEphemeralResult(state);

  // Tax is "on" whenever a non-zero rate is stored.
  const [chargeTax, setChargeTax] = useState(taxRate > 0);
  const [rate, setRate] = useState(taxRate > 0 ? String(taxRate) : "");

  // Re-sync to the saved values when the server sends fresh props after a save.
  useEffect(() => {
    setChargeTax(taxRate > 0);
    setRate(taxRate > 0 ? String(taxRate) : "");
  }, [taxRate]);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-800">Business settings</h2>
        <p className="text-sm text-slate-500">
          Your business name and how tax is applied to orders.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="businessName" className={labelClass}>
            Business name
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            defaultValue={businessName}
            placeholder="e.g. Blue Cup Cafe"
            className={inputClass}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="chargeTax"
              checked={chargeTax}
              onChange={(event) => setChargeTax(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">Charge tax on orders</span>
              <span className="block text-xs text-slate-500">
                Leave tax off if your business does not charge tax on sales.
              </span>
            </span>
          </label>

          {chargeTax && (
            <div>
              <label htmlFor="taxRate" className={labelClass}>
                Tax rate
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="taxRate"
                  name="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  placeholder="e.g. 9"
                  className={`${inputClass} w-32`}
                />
                <span className="text-sm text-slate-500">% of each order</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Enter the rate your business is registered to charge. There is no default.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SubmitButton />
          <ActionFeedback result={result} />
        </div>
      </form>
    </section>
  );
}
