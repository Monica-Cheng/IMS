"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateTableStatus } from "./actions";

type TableStatus = "available" | "occupied" | "reserved";

type Table = {
  id: string;
  name: string;
  capacity: number | null;
  shape: "square" | "rectangle" | "round";
  area_name: string | null;
  row_position: number;
  column_position: number;
  status: TableStatus;
};

const SHAPE_STYLES = {
  square: "rounded-2xl",
  rectangle: "rounded-xl",
  round: "rounded-[999px]",
} as const;

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  available: {
    label: "Available",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  occupied: {
    label: "Occupied",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  reserved: {
    label: "Reserved",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-400",
  },
};

const STATUS_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  available: ["occupied", "reserved"],
  occupied:  ["available", "reserved"],
  reserved:  ["available", "occupied"],
};

export default function TablesClient({
  initialTables,
  canManageTables,
}: {
  initialTables: Table[];
  canManageTables: boolean;
}) {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // tableId being updated
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync when server re-renders pass fresh props
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  // Realtime: subscribe to table changes and refresh server data
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tables-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleStatusChange(tableId: string, newStatus: TableStatus) {
    setLoading(tableId);
    setError(null);
    setSelectedId(null);

    // Optimistic update
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: newStatus } : t))
    );

    const result = await updateTableStatus(tableId, newStatus);
    setLoading(null);

    if (result.error) {
      setError(result.error);
      // Revert optimistic update
      setTables(initialTables);
    }
  }

  const available = tables.filter((t) => t.status === "available").length;
  const occupied  = tables.filter((t) => t.status === "occupied").length;
  const reserved  = tables.filter((t) => t.status === "reserved").length;

  if (tables.length === 0) {
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
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
        <p className="text-sm font-medium">No tables configured</p>
        <p className="text-xs mt-1">Add tables in Settings to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Tables</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tables.length} total · {available} available · {occupied} occupied
            {reserved > 0 ? ` · ${reserved} reserved` : ""}
          </p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Table grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map((table) => {
          const cfg = STATUS_CONFIG[table.status];
          const isSelected = selectedId === table.id;
          const isLoading = loading === table.id;
          const transitions = STATUS_TRANSITIONS[table.status];

          return (
            <div key={table.id} className="relative" ref={isSelected ? popoverRef : undefined}>
              {/* Table card */}
              <button
                onClick={() =>
                  setSelectedId(isSelected ? null : table.id)
                }
                disabled={isLoading}
                className={`w-full border-2 p-4 text-left transition-all shadow-sm hover:shadow-md active:scale-[0.97] ${SHAPE_STYLES[table.shape]} ${cfg.bg} ${cfg.border} ${
                  isLoading ? "opacity-60 cursor-wait" : "cursor-pointer"
                } ${isSelected ? "ring-2 ring-[#0EA5E9] ring-offset-1" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <span className="text-lg font-bold text-slate-800 leading-tight block">
                      {table.name}
                    </span>
                    {table.area_name ? (
                      <span className="text-xs text-slate-500 mt-1 block">
                        {table.area_name}
                      </span>
                    ) : null}
                  </div>
                  <div className="ml-3 flex-shrink-0 text-right">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400 block mb-1">
                      R{table.row_position} C{table.column_position}
                    </span>
                    {isLoading ? (
                      <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse mt-1.5 inline-block" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full mt-1.5 inline-block ${cfg.dot}`} />
                    )}
                  </div>
                </div>
                {table.capacity && (
                  <p className="text-xs text-slate-500 mb-2">
                    {table.capacity} seat{table.capacity !== 1 ? "s" : ""}
                  </p>
                )}
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">
                  {table.shape}
                </p>
                <span
                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                >
                  {cfg.label}
                </span>
              </button>

              {/* Status change popover */}
              {isSelected && (
                <div className="absolute top-full left-0 mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[140px]">
                  <p className="text-xs text-slate-400 font-medium px-2 py-1">
                    Change to
                  </p>
                  {transitions.map((s) => {
                    const tc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(table.id, s)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                        {tc.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200">
        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(
          ([status, cfg]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          )
        )}
        <p className="text-xs text-slate-400 ml-auto">
          {canManageTables ? "Tap a table to change status. Configure layout from the button above." : "Tap a table to change its status"}
        </p>
      </div>
    </div>
  );
}
