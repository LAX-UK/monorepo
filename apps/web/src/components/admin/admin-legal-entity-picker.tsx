"use client";

import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";
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

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

export type AdminLegalEntityPickerProps = {
  value: string | null;
  /** Shown when `value` is set (from parent after selection). */
  displayLabel: string | null;
  onChange: (id: string | null, row?: AdminLegalEntityPickerRow) => void;
  disabled?: boolean;
  /** Placeholder for the search field when no entity is selected. */
  searchPlaceholder?: string;
};

/** Admin-only: search legal entities by display name; optional empty query returns first page alphabetically. */
export function AdminLegalEntityPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  searchPlaceholder = "Search by organisation or entity name…",
}: AdminLegalEntityPickerProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AdminLegalEntityPickerRow[]>([]);
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
          const qs = new URLSearchParams({
            limit: "25",
            offset: "0",
          });
          const t = query.trim();
          if (t) qs.set("q", t);
          const res = await fetch(`${apiBase()}/admin/legal-entities/browse?${qs.toString()}`, {
            credentials: "include",
          });
          if (requestId !== lastSearchId.current) return;
          if (!res.ok) {
            setError("Search failed.");
            setHits([]);
          } else {
            const body = (await res.json()) as { data: AdminLegalEntityPickerRow[] };
            setHits(body.data);
          }
        } catch {
          if (requestId === lastSearchId.current) {
            setError("Search failed.");
            setHits([]);
          }
        } finally {
          if (requestId === lastSearchId.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function handleSelect(row: AdminLegalEntityPickerRow) {
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
          aria-label="Clear selected legal entity"
        >
          <X className="size-3.5" />
          Clear
        </InlineActionButton>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
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
          {hits.map((row) => (
            <div key={row.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(row)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-50"
              >
                <span className="font-medium text-on-surface">{row.displayName}</span>
                <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
                  {row.status.replaceAll("_", " ")}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {open && !loading && hits.length === 0 && !error ? (
        <p className="text-xs text-on-surface-variant">
          {query.trim() ? "No entities match that name." : "No legal entities returned."}
        </p>
      ) : null}
    </div>
  );
}
