"use client";

import { useState, useMemo } from "react";
import { submitOrder } from "./actions";
import type { CheckoutPayload } from "./actions";

// ── Types ────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  stock: number;
  category_id: string;
};
type Table = { id: string; name: string; capacity: number | null };
type CartItem = { product: Product; quantity: number };
type OrderType = "takeaway" | "dine-in";
type PaymentMethod = CheckoutPayload["paymentMethod"];
type Step = "cart" | "payment" | "success";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash",      label: "Cash" },
  { value: "card",      label: "Card" },
  { value: "grabpay",   label: "GrabPay" },
  { value: "paynow",    label: "PayNow" },
  { value: "wechatpay", label: "WeChat Pay" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function POSClient({
  categories,
  products,
  tables,
}: {
  categories: Category[];
  products: Product[];
  tables: Table[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [step, setStep] = useState<Step>("cart");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────

  const filteredProducts = useMemo(
    () =>
      selectedCategory
        ? products.filter((p) => p.category_id === selectedCategory)
        : products,
    [products, selectedCategory]
  );

  const cartTotal = useMemo(
    () =>
      Math.round(
        cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) *
          100
      ) / 100,
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // ── Cart mutations ──────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function resetOrder() {
    setCart([]);
    setOrderType("takeaway");
    setSelectedTableId("");
    setStep("cart");
    setPaymentMethod("cash");
    setError(null);
  }

  // ── Checkout ────────────────────────────────────────────────────────────────

  function handleCheckoutClick() {
    if (cart.length === 0) return;
    if (orderType === "dine-in" && tables.length > 0 && !selectedTableId) {
      setError("Please select a table for dine-in orders.");
      return;
    }
    setError(null);
    setStep("payment");
  }

  async function handleConfirmPayment() {
    if (isSubmitting || cart.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    const result = await submitOrder({
      orderType,
      tableId: orderType === "dine-in" ? selectedTableId : undefined,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
      })),
      paymentMethod,
      totalAmount: cartTotal,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStep("success");
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)] md:h-[calc(100vh-64px)]">
        <div className="text-center max-w-xs">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">
            Order Complete
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            Payment recorded and order sent to the kitchen.
          </p>
          <button
            onClick={resetOrder}
            className="px-8 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold rounded-xl transition-colors"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  // ── Main POS layout ─────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-[calc(100vh-48px)] md:h-[calc(100vh-64px)]">
      {/* ── LEFT: Product browser ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
        {/* Category filter strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? "bg-[#0EA5E9] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-[#0EA5E9] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <p className="text-sm">
                {products.length === 0
                  ? "No products available. Add products in the menu."
                  : "No products in this category."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                const atMax = !!inCart && inCart.quantity >= product.stock;
                return (
                  <button
                    key={product.id}
                    onClick={() => !atMax && addToCart(product)}
                    disabled={atMax}
                    className={`relative bg-white rounded-xl p-4 text-left shadow-sm border transition-all ${
                      atMax
                        ? "border-slate-200 opacity-50 cursor-not-allowed"
                        : "border-slate-100 hover:border-[#0EA5E9] hover:shadow-md active:scale-[0.98] cursor-pointer"
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0EA5E9] text-white text-xs font-bold leading-none">
                        {inCart.quantity}
                      </span>
                    )}
                    <p className="font-semibold text-slate-800 text-sm leading-snug mb-1.5 pr-6 line-clamp-2">
                      {product.name}
                    </p>
                    <p className="text-[#0EA5E9] font-bold text-sm">
                      ${Number(product.price).toFixed(2)}
                    </p>
                    {product.stock <= 5 && (
                      <p className="text-xs text-amber-500 mt-1">
                        {product.stock} left
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Order panel ───────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-shrink-0">
        {/* Panel header: order type + table selector */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Order Type
          </p>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              onClick={() => { setOrderType("takeaway"); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                orderType === "takeaway"
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              Takeaway
            </button>
            <button
              onClick={() => { setOrderType("dine-in"); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                orderType === "dine-in"
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              Dine-in
            </button>
          </div>

          {orderType === "dine-in" && (
            <div className="mt-3">
              {tables.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  No tables configured. Add tables in Settings first.
                </p>
              ) : (
                <select
                  value={selectedTableId}
                  onChange={(e) => {
                    setSelectedTableId(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                >
                  <option value="">Select a table…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.capacity ? ` (${t.capacity} seats)` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Cart items — scrollable middle section */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
              <svg
                className="w-8 h-8 mb-3 opacity-40"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                />
              </svg>
              <p className="text-sm">Tap a product to add it</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      ${Number(item.product.price).toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-slate-800 tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors ml-0.5"
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel footer: totals + checkout / payment ─────────────────────── */}
        <div className="border-t border-slate-100 p-4 space-y-3 flex-shrink-0">
          {step === "payment" ? (
            /* Payment method selection */
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Payment Method
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      paymentMethod === m.value
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold text-slate-700">
                  Total
                </span>
                <span className="text-xl font-bold text-[#1E3A5F] tabular-nums">
                  ${cartTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStep("cart");
                    setError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {isSubmitting ? "Processing…" : "Confirm"}
                </button>
              </div>
            </>
          ) : (
            /* Cart summary + checkout button */
            <>
              {cart.length > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-semibold text-slate-700">
                    Subtotal
                  </span>
                  <span className="text-xl font-bold text-[#1E3A5F] tabular-nums">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  {error}
                </p>
              )}

              <button
                onClick={handleCheckoutClick}
                disabled={cart.length === 0}
                className="w-full py-3 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {cart.length === 0
                  ? "Add items to start"
                  : `Checkout · ${cartCount} item${cartCount !== 1 ? "s" : ""} · $${cartTotal.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
