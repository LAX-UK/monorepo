"use client";

import { Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
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

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

type Props = {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
};

/** Admin-only: search platform users and link one as `ownerUserId` on an artist profile. */
export function UserPicker({ value, onChange, disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<AdminUserRow | null>(null);
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
        const res = await fetch(`${apiBase()}/admin/users/${encodeURIComponent(value)}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setResolved(null);
          return;
        }
        const body = (await res.json()) as { data: AdminUserRow };
        if (!cancelled) setResolved(body.data);
      } catch {
        if (!cancelled) setResolved(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    const t = query.trim();
    if (t.length < MIN_QUERY_LEN) {
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
          const qs = new URLSearchParams({
            q: t,
            limit: "10",
            offset: "0",
          });
          const res = await fetch(`${apiBase()}/admin/users?${qs.toString()}`, {
            credentials: "include",
          });
          if (requestId !== lastSearchId.current) return;
          if (!res.ok) {
            setError("Search failed.");
            setHits([]);
          } else {
            const body = (await res.json()) as { data: { rows: AdminUserRow[] } };
            setHits(body.data.rows);
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
  }, [query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function handleSelect(row: AdminUserRow) {
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
    const label = resolved ? `${resolved.name} · ${resolved.email}` : resolving ? "…" : value;
    const role = resolved?.role;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-on-surface">{label}</p>
          {resolving ? (
            <p className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </p>
          ) : resolved ? (
            role ? (
              <p className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
                Role: {role}
              </p>
            ) : null
          ) : (
            <p className="text-xs text-on-surface-variant">Linked user id (details unavailable)</p>
          )}
        </div>
        <InlineActionButton
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear linked user"
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
          placeholder="Search users by name or email…"
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
      {open && query.trim().length >= MIN_QUERY_LEN && hits.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
          {hits.map((row) => (
            <div key={row.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(row)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-50"
              >
                <span className="font-medium text-on-surface">{row.name}</span>
                <span className="text-xs text-on-surface-variant">{row.email}</span>
                <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
                  {row.role}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {open && query.trim().length >= MIN_QUERY_LEN && !loading && hits.length === 0 && !error ? (
        <p className="text-xs text-on-surface-variant">No users match.</p>
      ) : null}
      {query.trim().length > 0 && query.trim().length < MIN_QUERY_LEN ? (
        <p className="text-xs text-on-surface-variant">Type at least {MIN_QUERY_LEN} characters.</p>
      ) : null}
    </div>
  );
}
