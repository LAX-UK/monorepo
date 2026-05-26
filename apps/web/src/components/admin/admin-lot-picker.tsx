"use client";

import { searchAdminLotsBrowseAction } from "@/lib/actions/admin-lots-browse";
import type { AdminLotPickerRow } from "@/lib/data/http/admin.server";
import { Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

function InlineActionButton({
  onClick,
  disabled,
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className"> & {
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1 font-label text-[11px] uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
      {...rest}
    >
      {children}
    </button>
  );
}

export type AdminLotPickerProps = {
  value: string | null;
  displayLabel: string | null;
  onChange: (id: string | null, row?: AdminLotPickerRow) => void;
  disabled?: boolean;
  excludeSaleId?: string;
  sellerLegalEntityId?: string;
  searchPlaceholder?: string;
};

export function AdminLotPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  excludeSaleId,
  sellerLegalEntityId,
  searchPlaceholder = "Search draft lots by title…",
}: AdminLotPickerProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"available" | "returned" | "all">("all");
  const [hits, setHits] = useState<AdminLotPickerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const lastSearchId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const requestId = ++lastSearchId.current;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const t = query.trim();
          const result = await searchAdminLotsBrowseAction({
            ...(t ? { q: t } : {}),
            state,
            ...(excludeSaleId ? { excludeSaleId } : {}),
            ...(sellerLegalEntityId ? { sellerLegalEntityId } : {}),
            limit: 25,
            offset: 0,
          });
          if (requestId !== lastSearchId.current) return;
          if (!result.ok) {
            setError(result.error || "Search failed.");
            setHits([]);
            setTotal(0);
          } else {
            setHits(result.data?.rows ?? []);
            setTotal(result.data?.total ?? 0);
          }
        } catch {
          if (requestId === lastSearchId.current) {
            setError("Search failed.");
            setHits([]);
            setTotal(0);
          }
        } finally {
          if (requestId === lastSearchId.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, query, state, excludeSaleId, sellerLegalEntityId]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function handleSelect(row: AdminLotPickerRow) {
    onChange(row.id, row);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setHits([]);
  }

  if (value) {
    const label = displayLabel ?? value;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-on-surface">{label}</p>
          <p className="font-mono text-[11px] text-on-surface-variant">{value}</p>
        </div>
        <InlineActionButton
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear selected lot"
        >
          <X className="size-3.5" />
          Clear
        </InlineActionButton>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="flex flex-wrap gap-2">
        {(["available", "returned", "all"] as const).map((pill) => (
          <button
            key={pill}
            type="button"
            disabled={disabled}
            onClick={() => setState(pill)}
            className={`rounded-full px-3 py-1 font-label text-[10px] uppercase tracking-wide ${
              state === pill
                ? "bg-primary text-on-primary"
                : "border border-outline-variant/50 text-on-surface-variant"
            }`}
          >
            {pill === "available" ? "New drafts" : pill === "returned" ? "Returned" : "All"}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="search"
          autoComplete="off"
          disabled={disabled}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/70"
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-on-surface-variant" />
        ) : null}
      </div>
      {error ? <p className="text-xs text-error">{error}</p> : null}
      {open && hits.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
          <p className="px-3 py-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Showing {hits.length} of {total}
          </p>
          {hits.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(row)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-50"
            >
              <span className="font-medium text-on-surface">{row.title}</span>
              <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
                {row.lifecycle.kind === "returned" ? "Returned to inventory" : "New draft"}
                {row.lifecycle.lastSaleName ? ` · ${row.lifecycle.lastSaleName}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {open && !loading && hits.length === 0 && !error ? (
        <p className="text-xs text-on-surface-variant">
          {query.trim() ? "No attachable lots match." : "No attachable lots found."}
        </p>
      ) : null}
    </div>
  );
}
