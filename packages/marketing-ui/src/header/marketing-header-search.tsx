"use client";

import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { MarketingCloseIcon, MarketingSearchIcon } from "../marketing-icons.js";
import { type MarketingHeaderTone, headerSearchTriggerClass } from "./header-chrome-tone.js";
import { MarketingChromeIconButton } from "./marketing-chrome-icon-button.js";

export type MarketingHeaderSearchSuggestion = { label: string; href: string };

export type MarketingHeaderSearchProps = {
  /** Results route; the query is sent as `?q=`. */
  action: string;
  /** localStorage key for this product's recent searches. */
  recentStorageKey: string;
  suggestions?: readonly MarketingHeaderSearchSuggestion[];
  headerTone?: MarketingHeaderTone;
  className?: string;
};

const RECENT_LIMIT = 5;

// Storage can throw (private mode, blocked site data) or hold anything, so every access is guarded.
function readRecent(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string, recent: readonly string[]): void {
  try {
    if (recent.length > 0) window.localStorage.setItem(key, JSON.stringify(recent));
    else window.localStorage.removeItem(key);
  } catch {
    // Recent searches are a convenience; losing them is fine.
  }
}

function withRecent(recent: readonly string[], query: string): string[] {
  const lower = query.toLowerCase();
  return [query, ...recent.filter((item) => item.toLowerCase() !== lower)].slice(0, RECENT_LIMIT);
}

function matchesQuery(label: string, query: string): boolean {
  return query.length === 0 || label.toLowerCase().includes(query.toLowerCase());
}

const SECTION_TITLE =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";
const SUGGESTION_LINK = cn(
  "inline-flex min-h-11 items-center rounded-sm font-body text-base font-medium text-on-surface underline-offset-4 hover:underline",
  FOCUS_RING,
);

/**
 * Inline "Search" trigger that opens a full-width search shelf under the header
 * (Figma `826:14147`): input, clear control, recent searches and suggestions.
 */
export function MarketingHeaderSearch({
  action,
  recentStorageKey,
  suggestions = [],
  headerTone = "on-light",
  className,
}: MarketingHeaderSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [top, setTop] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const shelfId = useId();
  const recentTitleId = useId();
  const suggestedTitleId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const openShelf = () => {
    setRecent(readRecent(recentStorageKey));
    const anchor = triggerRef.current?.closest("header") ?? triggerRef.current;
    setTop(anchor?.getBoundingClientRect().bottom ?? 0);
    setOpen(true);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (shelfRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [open, close]);

  const searchHref = (value: string) => `${action}?q=${encodeURIComponent(value)}`;

  const remember = (value: string) => {
    const next = withRecent(recent, value);
    setRecent(next);
    writeRecent(recentStorageKey, next);
  };

  const forget = (value: string) => {
    const next = recent.filter((item) => item !== value);
    setRecent(next);
    writeRecent(recentStorageKey, next);
    inputRef.current?.focus();
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent(recentStorageKey, []);
    inputRef.current?.focus();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    remember(value);
    close(false);
    router.push(searchHref(value));
  };

  const trimmed = query.trim();
  const visibleRecent = recent.filter((item) => matchesQuery(item, trimmed));
  const visibleSuggestions = suggestions.filter((item) => matchesQuery(item.label, trimmed));

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? shelfId : undefined}
        onClick={() => (open ? close(false) : openShelf())}
        className={headerSearchTriggerClass(
          headerTone,
          cn(
            "min-h-11 w-[231px] justify-between gap-2 rounded-none border-b px-0 py-0 font-label text-sm font-normal",
            className,
          ),
        )}
      >
        <span className="site-header-search-placeholder text-on-surface-variant">Search</span>
        <MarketingSearchIcon className="site-header-search-icon size-5" aria-hidden />
      </Button>
      {open ? (
        <div
          ref={shelfRef}
          id={shelfId}
          // biome-ignore lint/a11y/useSemanticElements: non-modal shelf fixed under the header; a native dialog would need its UA styles and open state reset
          role="dialog"
          aria-label="Search"
          className="fixed inset-x-0 z-40 border-b border-nav-border bg-surface shadow-sm"
          style={{ top }}
        >
          <div
            className={cn(
              "mx-auto flex max-w-[var(--container-max,90rem)] justify-end py-6",
              MARKETING_PAGE_GUTTER_X,
            )}
          >
            <div className="flex w-full max-w-xl flex-col gap-6">
              <form
                aria-label="Search"
                onSubmit={onSubmit}
                className="flex items-center gap-2 border-b border-on-surface/40 focus-within:border-on-surface"
              >
                <Input
                  ref={inputRef}
                  variant="underline"
                  name="q"
                  type="text"
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label="Search"
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 flex-1 border-b-0"
                />
                <MarketingChromeIconButton
                  label={query ? "Clear search" : "Close search"}
                  onClick={() => {
                    if (query) {
                      setQuery("");
                      inputRef.current?.focus();
                    } else {
                      close(true);
                    }
                  }}
                >
                  <MarketingCloseIcon className="size-5" aria-hidden />
                </MarketingChromeIconButton>
              </form>
              {visibleRecent.length > 0 ? (
                <section aria-labelledby={recentTitleId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <h2 id={recentTitleId} className={SECTION_TITLE}>
                      Recent searches
                    </h2>
                    <Button type="button" variant="underline" onClick={clearRecent}>
                      Clear all
                    </Button>
                  </div>
                  <ul className="flex flex-col">
                    {visibleRecent.map((item) => (
                      <li key={item} className="flex items-center justify-between gap-4">
                        <Link
                          href={searchHref(item)}
                          className={SUGGESTION_LINK}
                          onClick={() => {
                            remember(item);
                            close(false);
                          }}
                        >
                          {item}
                        </Link>
                        <MarketingChromeIconButton
                          label={`Remove ${item} from recent searches`}
                          onClick={() => forget(item)}
                        >
                          <MarketingCloseIcon className="size-4" aria-hidden />
                        </MarketingChromeIconButton>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {visibleSuggestions.length > 0 ? (
                <section aria-labelledby={suggestedTitleId} className="flex flex-col gap-2">
                  <h2 id={suggestedTitleId} className={SECTION_TITLE}>
                    Suggested
                  </h2>
                  <ul className="flex flex-col">
                    {visibleSuggestions.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={SUGGESTION_LINK}
                          onClick={() => close(false)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
