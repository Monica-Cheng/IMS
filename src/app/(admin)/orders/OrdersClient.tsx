"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  product_name: string;
};

type Payment = {
  id: string;
  method: string;
  amount: number;
};

type Order = {
  id: string;
  type: "dine-in" | "takeaway";
  status: string;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  table_name: string | null;
  items: OrderItem[];
  payments: Payment[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_BADGE: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-700 border-yellow-200",
  "in-progress": "bg-blue-100 text-blue-700 border-blue-200",
  completed:   "bg-green-100 text-green-700 border-green-200",
  cancelled:   "bg-red-100 text-red-700 border-red-200",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash:      "Cash",
  card:      "Card",
  grabpay:   "GrabPay",
  paynow:    "PayNow",
  wechatpay: "WeChat Pay",
};

// ── Detail Panel ──────────────────────────────────────────────────────────────

function OrderDetail({ order }: { order: Order }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 pb-4 bg-slate-50">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Items */}
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Items
              </p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">
                      <span className="font-semibold text-slate-900">
                        {item.quantity}×
                      </span>{" "}
                      {item.product_name}
                    </span>
                    <span className="text-slate-600 tabular-nums">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-2">
                  <span className="text-slate-700">Total</span>
                  <span className="text-[#1E3A5F] tabular-nums">
                    ${Number(order.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment + metadata */}
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Payment & Details
              </p>
              <dl className="space-y-2 text-sm">
                {order.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <dt className="text-slate-500">Method</dt>
                    <dd className="font-medium text-slate-800">
                      {PAYMENT_LABELS[p.method] ?? p.method}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Type</dt>
                  <dd className="font-medium text-slate-800 capitalize">
                    {order.type}
                  </dd>
                </div>
                {order.table_name && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Table</dt>
                    <dd className="font-medium text-slate-800">
                      {order.table_name}
                    </dd>
                  </div>
                )}
                {order.notes && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Notes</dt>
                    <dd className="font-medium text-slate-800 text-right max-w-[60%]">
                      {order.notes}
                    </dd>
                  </div>
                )}
                {order.completed_at && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Completed</dt>
                    <dd className="font-medium text-slate-800">
                      {formatDate(order.completed_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrdersClient({ orders }: { orders: Order[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const totalRevenue = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <svg
          className="w-10 h-10 mb-4 opacity-40"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
          />
        </svg>
        <p className="text-sm font-medium">No orders yet</p>
        <p className="text-xs mt-1">Orders placed from the POS will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {orders.length} order{orders.length !== 1 ? "s" : ""} · $
            {totalRevenue.toFixed(2)} total revenue
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Table
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Payment
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isExpanded = expandedId === order.id;
                const paymentMethod =
                  order.payments[0]?.method ?? null;

                return (
                  <>
                    <tr
                      key={order.id}
                      onClick={() => toggle(order.id)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-blue-50 border-blue-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 font-medium">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${
                            order.type === "dine-in"
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-purple-50 text-purple-700 border-purple-100"
                          }`}
                        >
                          {order.type === "dine-in" ? "Dine-in" : "Takeaway"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {order.table_name ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {paymentMethod
                          ? PAYMENT_LABELS[paymentMethod] ?? paymentMethod
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        ${Number(order.total_amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${
                            STATUS_BADGE[order.status] ??
                            "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {order.status.replace("-", " ")}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && <OrderDetail key={`detail-${order.id}`} order={order} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
