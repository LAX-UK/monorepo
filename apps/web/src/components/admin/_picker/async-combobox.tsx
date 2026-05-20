"use client";

import { Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

export type AsyncComboboxHit = {
  id: string;
};

export type AsyncComboboxProps<THit extends AsyncComboboxHit> = {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  minQueryLen?: number;
  placeholder?: string;
  searchHits: (query: string) => Promise<THit[]>;
  resolveHit: (id: string) => Promise<THit | null>;
  renderHit: (hit: THit) => ReactNode;
  renderSelected: (hit: THit) => ReactNode;
  renderSelectedFallback?: (id: string) => ReactNode;
  clearLabel?: string;
};

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

/** Generic debounced async search combobox for admin pickers. */
export function AsyncCombobox<THit extends AsyncComboboxHit>({
  value,
  onChange,
  disabled = false,
  minQueryLen = 2,
  placeholder = "Search…",
  searchHits,
  resolveHit,
  renderHit,
  renderSelected,
  renderSelectedFallback,
  clearLabel = "Clear",
}: AsyncComboboxProps<THit>) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<THit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<THit | null>(null);
  const [resolving, setResolving] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSearchId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    void (async () => {
      try {
        const hit = await resolveHit(value);
        if (!cancelled) setResolved(hit);
      } catch {
        if (!cancelled) setResolved(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, resolveHit]);

  useEffect(() => {
    const t = query.trim();
    if (t.length < minQueryLen) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const requestId = ++lastSearchId.current;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchHits(t);
          if (requestId !== lastSearchId.current) return;
          setHits(rows);
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
  }, [query, minQueryLen, searchHits]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function handleSelect(row: THit) {
    onChange(row.id);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setHits([]);
    setResolved(null);
  }

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3">
        <div className="min-w-0 flex-1">
          {resolving ? (
            <p className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </p>
          ) : resolved ? (
            renderSelected(resolved)
          ) : renderSelectedFallback ? (
            renderSelectedFallback(value)
          ) : (
            <p className="text-xs text-on-surface-variant">Selected id: {value}</p>
          )}
        </div>
        <InlineActionButton onClick={handleClear} disabled={disabled} aria-label={clearLabel}>
          <X className="size-3.5" />
          {clearLabel}
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
          placeholder={placeholder}
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
      {open && query.trim().length >= minQueryLen && hits.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
          {hits.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(row)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-50"
            >
              {renderHit(row)}
            </button>
          ))}
        </div>
      ) : null}
      {open && query.trim().length >= minQueryLen && !loading && hits.length === 0 && !error ? (
        <p className="text-xs text-on-surface-variant">No matches.</p>
      ) : null}
      {query.trim().length > 0 && query.trim().length < minQueryLen ? (
        <p className="text-xs text-on-surface-variant">Type at least {minQueryLen} characters.</p>
      ) : null}
    </div>
  );
}
