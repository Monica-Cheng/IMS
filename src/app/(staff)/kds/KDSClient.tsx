"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { advanceTicket } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type KdsStatus = "pending" | "preparing" | "ready";

type KDSItem = {
  id: string;
  quantity: number;
  product_name: string;
};

type KDSTicket = {
  id: string;
  status: KdsStatus;
  created_at: string;
  order_id: string;
  order_type: "dine-in" | "takeaway";
  order_notes: string | null;
  table_name: string | null;
  items: KDSItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const STATUS_STYLE: Record<
  KdsStatus,
  { border: string; badge: string; badgeText: string; label: string }
> = {
  pending:   { border: "border-red-500",    badge: "bg-red-500",    badgeText: "text-white", label: "New" },
  preparing: { border: "border-amber-400",  badge: "bg-amber-400",  badgeText: "text-gray-900", label: "Preparing" },
  ready:     { border: "border-green-500",  badge: "bg-green-500",  badgeText: "text-white", label: "Ready" },
};

// ── Ticket Card ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onAdvance,
}: {
  ticket: KDSTicket;
  onAdvance: (ticketId: string, orderId: string, status: KdsStatus) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = STATUS_STYLE[ticket.status];
  const isReady = ticket.status === "ready";

  async function handleAdvance() {
    if (loading || isReady) return;
    setLoading(true);
    setError(null);
    await onAdvance(ticket.id, ticket.order_id, ticket.status);
    setLoading(false);
  }

  return (
    <div
      className={`flex flex-col bg-gray-800 rounded-xl border-l-4 ${style.border} overflow-hidden ${
        isReady ? "opacity-60" : ""
      }`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">
              #{ticket.order_id.slice(-6).toUpperCase()}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge} ${style.badgeText}`}
            >
              {style.label}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ticket.order_type === "dine-in" ? (
              <span className="text-xs text-blue-300 font-medium">
                🪑 {ticket.table_name ?? "Dine-in"}
              </span>
            ) : (
              <span className="text-xs text-purple-300 font-medium">
                📦 Takeaway
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0 ml-2 mt-0.5">
          {elapsed(ticket.created_at)}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-700 mx-4" />

      {/* Items */}
      <ul className="px-4 py-3 space-y-1.5 flex-1">
        {ticket.items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-2">
            <span className="text-white font-bold text-lg leading-none w-6 flex-shrink-0 tabular-nums">
              {item.quantity}×
            </span>
            <span className="text-gray-200 text-sm leading-snug">
              {item.product_name}
            </span>
          </li>
        ))}
      </ul>

      {/* Notes */}
      {ticket.order_notes && (
        <p className="px-4 pb-2 text-xs text-amber-300 italic">
          Note: {ticket.order_notes}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="px-4 pb-2 text-xs text-red-400">{error}</p>
      )}

      {/* Action */}
      {!isReady && (
        <div className="px-4 pb-4">
          <button
            onClick={handleAdvance}
            disabled={loading}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              ticket.status === "pending"
                ? "bg-amber-400 hover:bg-amber-300 text-gray-900"
                : "bg-green-500 hover:bg-green-400 text-white"
            }`}
          >
            {loading
              ? "Updating…"
              : ticket.status === "pending"
              ? "Start Preparing"
              : "Mark Ready"}
          </button>
        </div>
      )}

      {isReady && (
        <div className="px-4 pb-4">
          <div className="w-full py-2 text-center text-sm text-green-400 font-medium">
            ✓ Order Complete
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function KDSClient({
  initialTickets,
}: {
  initialTickets: KDSTicket[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Realtime: any kds_tickets change triggers a server refresh so the
  // server component re-fetches and passes fresh data.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kds_tickets" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleAdvance(
    ticketId: string,
    orderId: string,
    currentStatus: KdsStatus
  ) {
    const result = await advanceTicket(ticketId, orderId, currentStatus);
    if (result.error) {
      setErrors((prev) => ({ ...prev, [ticketId]: result.error! }));
      // Clear error after 6 seconds
      setTimeout(
        () => setErrors((prev) => { const next = { ...prev }; delete next[ticketId]; return next; }),
        6000
      );
    }
  }

  const pending   = initialTickets.filter((t) => t.status === "pending");
  const preparing = initialTickets.filter((t) => t.status === "preparing");
  const ready     = initialTickets.filter((t) => t.status === "ready");

  const ticketsWithErrors = initialTickets.map((t) => ({
    ...t,
    _error: errors[t.id],
  }));

  return (
    <div className="-m-6 md:-m-8 bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pending.length} new · {preparing.length} preparing · {ready.length} done
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live
        </div>
      </div>

      {initialTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <svg
            className="w-12 h-12 mb-4 opacity-40"
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
          <p className="text-base font-medium text-gray-500">No active orders</p>
          <p className="text-sm mt-1 text-gray-600">
            New orders from the POS will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Pending first, then preparing, then ready */}
          {[...pending, ...preparing, ...ready].map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={{
                ...ticket,
                order_notes:
                  errors[ticket.id]
                    ? `⚠ ${errors[ticket.id]}`
                    : ticket.order_notes,
              }}
              onAdvance={handleAdvance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
