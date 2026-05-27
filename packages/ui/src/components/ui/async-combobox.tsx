"use client";

import { Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";

const DEBOUNCE_MS = 300;

export type AsyncComboboxHit = {
  id: string;
};

export type AsyncComboboxProps<THit extends AsyncComboboxHit> = {
  value: string | null;
  onChange: (id: string | null, hit?: THit) => void;
  onBlur?: () => void;
  disabled?: boolean;
  minQueryLen?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  searchHits: (query: string) => Promise<THit[]>;
  resolveHit: (id: string) => Promise<THit | null>;
  renderHit: (hit: THit) => ReactNode;
  renderSelected: (hit: THit) => ReactNode;
  renderSelectedFallback?: (id: string) => ReactNode;
  clearLabel?: string;
  changeLabel?: string;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 font-label text-[11px] uppercase tracking-wide"
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Debounced async search combobox built on Command + Popover. */
export function AsyncCombobox<THit extends AsyncComboboxHit>({
  value,
  onChange,
  onBlur,
  disabled = false,
  minQueryLen = 2,
  placeholder = "Search…",
  searchPlaceholder = "Search…",
  searchHits,
  resolveHit,
  renderHit,
  renderSelected,
  renderSelectedFallback,
  clearLabel = "Clear",
  changeLabel = "Change",
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: AsyncComboboxProps<THit>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<THit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resolved, setResolved] = React.useState<THit | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const lastSearchId = React.useRef(0);

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  function handleSelect(row: THit) {
    onChange(row.id, row);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setHits([]);
    setResolved(null);
    setOpen(false);
  }

  const comboboxA11y = {
    id,
    role: "combobox" as const,
    "aria-expanded": open,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    onBlur,
  };

  const searchPanel = (
    <Command shouldFilter={false}>
      <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
      <CommandList>
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-on-surface-variant">
            <Loader2 className="size-4 animate-spin" />
            Searching…
          </div>
        ) : null}
        {error ? <CommandEmpty>{error}</CommandEmpty> : null}
        {!loading && !error && query.trim().length >= minQueryLen && hits.length === 0 ? (
          <CommandEmpty>No matches.</CommandEmpty>
        ) : null}
        {query.trim().length > 0 && query.trim().length < minQueryLen ? (
          <CommandEmpty>Type at least {minQueryLen} characters.</CommandEmpty>
        ) : null}
        <CommandGroup>
          {hits.map((row) => (
            <CommandItem key={row.id} value={row.id} onSelect={() => handleSelect(row)}>
              {renderHit(row)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const selectedSummary =
    value && resolving ? (
      <p className="flex items-center gap-1 text-xs text-on-surface-variant">
        <Loader2 className="size-3.5 animate-spin" />
        Loading…
      </p>
    ) : value && resolved ? (
      renderSelected(resolved)
    ) : value && renderSelectedFallback ? (
      renderSelectedFallback(value)
    ) : value ? (
      <p className="text-xs text-on-surface-variant">Selected id: {value}</p>
    ) : null;

  if (value) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3",
          className,
        )}
      >
        <div className="min-w-0 flex-1">{selectedSummary}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <InlineActionButton {...comboboxA11y} disabled={disabled} aria-label={changeLabel}>
                {changeLabel}
              </InlineActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              {searchPanel}
            </PopoverContent>
          </Popover>
          <InlineActionButton onClick={handleClear} disabled={disabled} aria-label={clearLabel}>
            <X className="size-3.5" />
            {clearLabel}
          </InlineActionButton>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "min-h-11 w-full justify-start px-3 font-body text-sm font-normal text-on-surface-variant",
            className,
          )}
          {...comboboxA11y}
        >
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {searchPanel}
      </PopoverContent>
    </Popover>
  );
}
