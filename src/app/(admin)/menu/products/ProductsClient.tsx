"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  adjustProductStock,
  createProduct,
  toggleProductAvailability,
  updateProduct,
  type ProductActionResult,
} from "../actions";

type Category = { id: string; name: string };

type Product = {
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

// Gross margin on the selling price, as a whole-number percent.
// Returns null when there is no recorded cost, or no price to divide by.
function marginPercent(price: number, costPrice: number | null): number | null {
  const p = Number(price);
  if (costPrice == null || !Number.isFinite(p) || p <= 0) return null;
  return Math.round(((p - Number(costPrice)) / p) * 100);
}

const COST_HELP = "What you pay your supplier. Used for margin reporting.";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400";

// Mirror a server-action result into local state that clears itself after ~4s.
function useEphemeralResult(state: ProductActionResult | null) {
  const [shown, setShown] = useState<ProductActionResult | null>(null);

  useEffect(() => {
    if (!state) return;
    setShown(state);
    const timer = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  return shown;
}

function ActionFeedback({ result }: { result: ProductActionResult | null }) {
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

function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
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

// ── Add product ──────────────────────────────────────────────────────────────

function AddProductForm({ categories }: { categories: Category[] }) {
  const [state, formAction] = useFormState(createProduct, null);
  const result = useEphemeralResult(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
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
        <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <input name="name" type="text" required placeholder="Product name" className={inputClass} />
          <select name="categoryId" required defaultValue="" className={inputClass}>
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
            className={`${inputClass} xl:col-span-2`}
          />
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="Price"
            className={inputClass}
          />
          <div className="space-y-1">
            <input
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost price (optional)"
              aria-describedby="add-cost-help"
              className={inputClass}
            />
            <p id="add-cost-help" className="text-xs text-slate-400">
              {COST_HELP}
            </p>
          </div>
          <input
            name="stock"
            type="number"
            min="0"
            required
            defaultValue={0}
            placeholder="Stock quantity"
            className={inputClass}
          />
          <input
            name="imageUrl"
            type="url"
            placeholder="Optional image URL"
            className={`${inputClass} xl:col-span-2`}
          />
          <div className="space-y-3 xl:col-span-2">
            <SubmitButton
              pendingLabel="Adding…"
              className="w-full rounded-xl bg-[#0EA5E9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7]"
            >
              Add product
            </SubmitButton>
            <ActionFeedback result={result} />
          </div>
        </form>
      )}
    </section>
  );
}

// ── Product row (collapsed summary + revealed edit panel) ─────────────────────

function ProductRow({
  product,
  categories,
  expanded,
  onToggle,
}: {
  product: Product;
  categories: Category[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  const [updateState, updateAction] = useFormState(updateProduct, null);
  const [stockState, stockAction] = useFormState(adjustProductStock, null);
  const [availState, availAction] = useFormState(toggleProductAvailability, null);

  const updateResult = useEphemeralResult(updateState);
  const stockResult = useEphemeralResult(stockState);
  const availResult = useEphemeralResult(availState);

  // Controlled so the field can be cleared on a successful adjustment while
  // keeping whatever was typed when the action comes back with an error.
  const [delta, setDelta] = useState("1");
  useEffect(() => {
    if (stockState?.ok) setDelta("");
  }, [stockState]);

  const margin = marginPercent(product.price, product.cost_price);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Collapsed summary — real button, keyboard operable */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/40"
      >
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">{product.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {product.categories?.name ?? "Uncategorized"}
          </span>
        </span>
        <span className="hidden w-20 flex-shrink-0 text-right text-sm text-slate-600 tabular-nums sm:block">
          ${Number(product.price).toFixed(2)}
        </span>
        <span className="hidden w-24 flex-shrink-0 text-right text-sm text-slate-600 tabular-nums sm:block">
          {product.stock} in stock
        </span>
        {margin !== null && (
          <span className="hidden w-24 flex-shrink-0 text-right text-sm text-slate-600 tabular-nums sm:block">
            {margin}% margin
          </span>
        )}
        <span className="flex-shrink-0">
          <AvailabilityBadge available={product.is_available} />
        </span>
      </button>

      {/* Revealed edit panel */}
      {expanded && (
        <div id={panelId} className="space-y-6 border-t border-slate-100 p-5">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 sm:hidden">
            <span>Price ${Number(product.price).toFixed(2)}</span>
            <span>{product.stock} in stock</span>
            {margin !== null && <span>{margin}% margin</span>}
          </div>

          {/* Edit details — no stock field */}
          <form action={updateAction} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <input type="hidden" name="id" value={product.id} />
            <div>
              <label className={labelClass}>Product name</label>
              <input name="name" type="text" defaultValue={product.name} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                name="categoryId"
                defaultValue={product.category_id}
                required
                className={inputClass}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="xl:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={product.description ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Price</label>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(product.price)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`cost-${product.id}`}>
                Cost price
              </label>
              <input
                id={`cost-${product.id}`}
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={product.cost_price ?? ""}
                placeholder="Optional"
                aria-describedby={`cost-help-${product.id}`}
                className={inputClass}
              />
              <p id={`cost-help-${product.id}`} className="mt-1 text-xs text-slate-400">
                {COST_HELP}
              </p>
            </div>
            <div>
              <span className={labelClass}>Current stock</span>
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{product.stock}</span>
                <span className="ml-2 text-xs text-slate-400">
                  Change it with “Adjust stock” below.
                </span>
              </p>
            </div>
            <div className="xl:col-span-2">
              <label className={labelClass}>Image URL</label>
              <input
                name="imageUrl"
                type="url"
                defaultValue={product.image_url ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-3 xl:col-span-2">
              <SubmitButton
                pendingLabel="Saving…"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Save changes
              </SubmitButton>
              <ActionFeedback result={updateResult} />
            </div>
          </form>

          {/* Stock + availability */}
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 xl:flex-row xl:items-start xl:justify-between">
            <p className="text-sm text-slate-500">
              Added{" "}
              {new Date(product.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <form action={stockAction} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={product.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">
                      Adjust by (+ adds, − removes)
                    </span>
                    <input
                      name="delta"
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={delta}
                      onChange={(event) => setDelta(event.target.value)}
                      placeholder="e.g. 5 or -5"
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
                    />
                  </label>
                  <SubmitButton
                    pendingLabel="Adjusting…"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Adjust stock
                  </SubmitButton>
                </form>

                <form action={availAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="nextValue" value={product.is_available ? "false" : "true"} />
                  <SubmitButton
                    pendingLabel="Updating…"
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      product.is_available
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}
                  >
                    {product.is_available ? "Turn off availability" : "Turn on availability"}
                  </SubmitButton>
                </form>
              </div>
              <ActionFeedback result={stockResult} />
              <ActionFeedback result={availResult} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ProductsClient({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      <AddProductForm categories={categories} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Your products</h2>
          <p className="text-sm text-slate-500">
            Click a product to edit its details, adjust stock, or change availability.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No products yet. Add your first product above.
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                categories={categories}
                expanded={expandedId === product.id}
                onToggle={() =>
                  setExpandedId((current) => (current === product.id ? null : product.id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
