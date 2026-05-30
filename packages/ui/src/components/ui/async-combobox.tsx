"use client";

import { Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button, type ButtonProps } from "./button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.js";
import { DetachedPickerShell } from "./detached-picker-shell.js";

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

type PickerComboboxTriggerProps = Omit<ButtonProps, "variant" | "asChild" | "type">;

const PickerComboboxTrigger = React.forwardRef<HTMLButtonElement, PickerComboboxTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <Button ref={ref} type="button" variant="outline" className={className} {...props}>
      {children}
    </Button>
  ),
);
PickerComboboxTrigger.displayName = "PickerComboboxTrigger";

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

/** Debounced async search combobox with detached overlay shell (no Radix trigger refs). */
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
  const lastSelectedIdRef = React.useRef<string | null>(null);
  const lastSelectedRowRef = React.useRef<THit | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!value) {
      setResolved(null);
      setResolving(false);
      lastSelectedIdRef.current = null;
      lastSelectedRowRef.current = null;
      return;
    }
    const cached = lastSelectedRowRef.current;
    if (lastSelectedIdRef.current === value && cached?.id === value) {
      setResolved(cached);
      setResolving(false);
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
    lastSelectedIdRef.current = row.id;
    lastSelectedRowRef.current = row;
    setOpen(false);
    setQuery("");
    setHits([]);
    setResolved(row);
    setResolving(false);
    onChange(row.id, row);
  }

  function handleClear() {
    lastSelectedIdRef.current = null;
    lastSelectedRowRef.current = null;
    setOpen(false);
    setQuery("");
    setHits([]);
    setResolved(null);
    setResolving(false);
    onChange(null);
  }

  const selectedHit =
    resolved ??
    (value && lastSelectedRowRef.current?.id === value ? lastSelectedRowRef.current : null);

  const showSelectedChrome = Boolean(value);
  const triggerLabel = value ? changeLabel : placeholder;

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

  const selectedSummary = value ? (
    resolving && !selectedHit ? (
      <p className="flex items-center gap-1 text-xs text-on-surface-variant">
        <Loader2 className="size-3.5 animate-spin" />
        Loading…
      </p>
    ) : selectedHit ? (
      renderSelected(selectedHit)
    ) : renderSelectedFallback ? (
      renderSelectedFallback(value)
    ) : (
      <p className="text-xs text-on-surface-variant">Selected id: {value}</p>
    )
  ) : null;

  const pickerTrigger = (
    <PickerComboboxTrigger
      ref={triggerRef}
      id={id}
      // biome-ignore lint/a11y/useSemanticElements: searchable popover combobox; native select cannot host Command list
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      {...(value ? { "aria-label": changeLabel } : {})}
      onBlur={onBlur}
      disabled={disabled}
      data-selected={value ? "" : undefined}
      onClick={() => {
        if (disabled) return;
        setOpen((prev) => !prev);
      }}
      className={cn(
        "min-h-11 w-full justify-start px-3 font-body text-sm font-normal text-on-surface-variant",
        className,
      )}
    >
      {triggerLabel}
    </PickerComboboxTrigger>
  );

  return (
    <div className="w-full">
      <div
        className={cn(
          "mb-2 flex flex-wrap items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3",
          !showSelectedChrome && "hidden",
        )}
        aria-hidden={!showSelectedChrome}
      >
        <div className="min-w-0 flex-1">{selectedSummary}</div>
        <InlineActionButton
          onClick={handleClear}
          disabled={disabled || !value}
          aria-label={clearLabel}
        >
          <X className="size-3.5" />
          {clearLabel}
        </InlineActionButton>
      </div>
      <div
        className="w-full"
        data-slot="async-combobox-trigger"
        data-testid="async-combobox-trigger-slot"
      >
        <DetachedPickerShell
          open={open}
          onOpenChange={setOpen}
          anchorRef={triggerRef}
          trigger={pickerTrigger}
          panel={searchPanel}
          sheetTitle={searchPlaceholder}
          popoverContentClassName="p-0"
        />
      </div>
    </div>
  );
}
