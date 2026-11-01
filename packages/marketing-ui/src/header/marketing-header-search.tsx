"use client";

import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  MarketingCloseIcon,
  MarketingSearchIcon,
  MarketingSpinnerIcon,
} from "../marketing-icons.js";
import { MediaImage } from "../media/media-image.js";
import { type MarketingHeaderTone, headerSearchTriggerClass } from "./header-chrome-tone.js";
import { MarketingChromeIconButton } from "./marketing-chrome-icon-button.js";

export type MarketingHeaderSearchSuggestion = { label: string; href: string };

/** One live result: a title, an optional second line and an optional thumbnail. */
export type MarketingHeaderSearchResult = {
  id: string;
  label: string;
  detail?: string | undefined;
  href: string;
  /** Shown uncropped on a mat; omitted for results that have no picture (artists). */
  imageUrl?: string | null | undefined;
  /** `circle` for portraits (cropped to fill); artwork stays square and uncropped. */
  imageShape?: "square" | "circle" | undefined;
};

export type MarketingHeaderSearchResultGroup = {
  id: string;
  /** Group heading, e.g. "Editions" or "Artists". */
  title: string;
  items: readonly MarketingHeaderSearchResult[];
};

export type MarketingHeaderSearchLoader = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly MarketingHeaderSearchResultGroup[]>;

export type MarketingHeaderSearchProps = {
  /** Results route; the query is sent as `?q=`. */
  action: string;
  /** localStorage key for this product's recent searches. */
  recentStorageKey: string;
  suggestions?: readonly MarketingHeaderSearchSuggestion[];
  /**
   * Live results while typing, grouped (for example editions, then artists). The input becomes a
   * combobox: arrow keys move through the results, Enter opens one, and the last option searches
   * the results route for the whole query.
   */
  loadResults?: MarketingHeaderSearchLoader;
  /** Field placeholder and accessible name of the input. */
  placeholder?: string;
  /**
   * Below 1024px, show an icon trigger instead of the field and open the search as a full-screen
   * sheet that holds focus until it closes.
   */
  compactBelowDesktop?: boolean;
  headerTone?: MarketingHeaderTone;
  /** Reports the shelf opening or closing, so the header can turn solid while it is open. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const RECENT_LIMIT = 5;
/** Characters needed before live results are fetched. */
export const HEADER_SEARCH_MIN_QUERY = 2;
const RESULTS_DEBOUNCE_MS = 180;
const DESKTOP_QUERY = "(min-width: 64rem)";

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

function isDesktopViewport(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP_QUERY).matches;
}

/** "2 editions and 1 artist" from the group titles, for the live region. */
export function headerSearchResultSummary(
  groups: readonly MarketingHeaderSearchResultGroup[],
): string {
  const parts = groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const noun = group.title.toLowerCase();
      const singular = noun.endsWith("s") ? noun.slice(0, -1) : noun;
      return `${group.items.length} ${group.items.length === 1 ? singular : noun}`;
    });
  if (parts.length === 0) return "No results";
  if (parts.length === 1) return `${parts[0]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

type ResultsState =
  | { status: "idle" }
  | { status: "loading"; query: string; groups: readonly MarketingHeaderSearchResultGroup[] }
  | { status: "ready"; query: string; groups: readonly MarketingHeaderSearchResultGroup[] }
  | { status: "error"; query: string };

type FlatOption = { id: string; href: string; searchAll: boolean };

const SECTION_TITLE = "font-label text-xs text-on-surface-variant";
const SUGGESTION_LINK = cn(
  "inline-flex min-h-11 items-center rounded-sm font-body text-base font-medium text-on-surface underline-offset-4 hover:underline",
  FOCUS_RING,
);
const OPTION_ROW =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 font-body text-on-surface aria-selected:bg-surface-container-low aria-selected:outline-2 aria-selected:outline-ring aria-selected:-outline-offset-2 hover:bg-surface-container-low";

/**
 * Inline "Search" trigger that opens a full-width search shelf under the header
 * (Figma `826:14147`): input, clear control, recent searches and suggestions, and, when the
 * product supplies `loadResults`, live results grouped by kind.
 */
export function MarketingHeaderSearch({
  action,
  recentStorageKey,
  suggestions = [],
  loadResults,
  placeholder = "Search",
  compactBelowDesktop = false,
  headerTone = "on-light",
  onOpenChange,
  className,
}: MarketingHeaderSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [top, setTop] = useState(0);
  const [results, setResults] = useState<ResultsState>({ status: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const compactTriggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const shelfId = useId();
  const listboxId = useId();
  const optionPrefix = useId();
  const recentTitleId = useId();
  const suggestedTitleId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setResults({ status: "idle" });
    setActiveIndex(-1);
    if (restoreFocus) openerRef.current?.focus();
  }, []);

  const openShelf = (opener: HTMLButtonElement | null) => {
    openerRef.current = opener;
    setRecent(readRecent(recentStorageKey));
    const asSheet = compactBelowDesktop && !isDesktopViewport();
    setSheet(asSheet);
    const anchor = opener?.closest("header") ?? opener;
    setTop(asSheet ? 0 : (anchor?.getBoundingClientRect().bottom ?? 0));
    setOpen(true);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // The phone sheet covers the page, so the page behind it does not scroll.
  useEffect(() => {
    if (!open || !sheet) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      // The sheet is modal: Tab cycles inside it.
      if (event.key !== "Tab" || !sheet || !shelfRef.current) return;
      const focusable = [
        ...shelfRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        shelfRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        compactTriggerRef.current?.contains(target)
      ) {
        return;
      }
      close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [open, sheet, close]);

  const trimmed = query.trim();
  const live = Boolean(loadResults) && trimmed.length >= HEADER_SEARCH_MIN_QUERY;

  // Debounced live results; a newer query aborts the request before it.
  useEffect(() => {
    if (!open || !loadResults || trimmed.length < HEADER_SEARCH_MIN_QUERY) {
      setResults({ status: "idle" });
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    setResults((previous) => ({
      status: "loading",
      query: trimmed,
      groups: previous.status === "ready" || previous.status === "loading" ? previous.groups : [],
    }));
    setActiveIndex(-1);
    const timer = window.setTimeout(() => {
      loadResults(trimmed, controller.signal)
        .then((groups) => {
          if (!controller.signal.aborted) setResults({ status: "ready", query: trimmed, groups });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults({ status: "error", query: trimmed });
        });
    }, RESULTS_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, loadResults, trimmed]);

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

  const go = (href: string, value: string) => {
    if (value) remember(value);
    close(false);
    router.push(href);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;
    go(searchHref(trimmed), trimmed);
  };

  const groups =
    results.status === "ready" || results.status === "loading"
      ? results.groups.filter((group) => group.items.length > 0)
      : [];
  const options: FlatOption[] = live
    ? [
        ...groups.flatMap((group) =>
          group.items.map((item) => ({
            id: `${optionPrefix}-${group.id}-${item.id}`,
            href: item.href,
            searchAll: false,
          })),
        ),
        { id: `${optionPrefix}-all`, href: searchHref(trimmed), searchAll: true },
      ]
    : [];
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!live || options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => {
        if (index < 0) return step === 1 ? 0 : options.length - 1;
        return (index + step + options.length) % options.length;
      });
      return;
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      go(activeOption.href, trimmed);
    }
  };

  // Keep the active option in view when the arrow keys move past the visible list.
  useEffect(() => {
    if (!activeOption) return;
    const node = document.getElementById(activeOption.id);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [activeOption]);

  const visibleRecent = live ? [] : recent.filter((item) => matchesQuery(item, trimmed));
  const visibleSuggestions = live
    ? []
    : suggestions.filter((item) => matchesQuery(item.label, trimmed));

  const statusText = !live
    ? ""
    : results.status === "loading"
      ? "Searching…"
      : results.status === "error"
        ? "Suggestions are unavailable. Press Enter to search."
        : results.status === "ready"
          ? groups.length > 0
            ? `${headerSearchResultSummary(groups)}.`
            : `No matches for “${trimmed}”.`
          : "";

  const optionIndex = (id: string) => options.findIndex((option) => option.id === id);

  const renderOption = (option: FlatOption, content: ReactNode, label: string) => {
    const index = optionIndex(option.id);
    return (
      <div
        key={option.id}
        id={option.id}
        // biome-ignore lint/a11y/useSemanticElements: a combobox option holds a thumbnail and two lines, which a native option cannot
        role="option"
        aria-selected={index === activeIndex}
        aria-label={label}
        tabIndex={-1}
        className={OPTION_ROW}
        // Keep focus in the input so typing and the arrow keys keep working.
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          if (index !== activeIndex) setActiveIndex(index);
        }}
        onClick={() => go(option.href, trimmed)}
        onKeyDown={(event) => {
          if (event.key === "Enter") go(option.href, trimmed);
        }}
      >
        {content}
      </div>
    );
  };

  const searchAllOption = options[options.length - 1];

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? shelfId : undefined}
        onClick={() => (open ? close(false) : openShelf(triggerRef.current))}
        className={headerSearchTriggerClass(
          headerTone,
          cn(
            "min-h-11 w-[231px] justify-between gap-2 rounded-none border-b px-0 py-0 font-label text-sm font-normal",
            compactBelowDesktop && "hidden lg:inline-flex",
            className,
          ),
        )}
      >
        <span
          className={cn(
            "site-header-search-placeholder",
            headerTone === "on-dark" ? "text-hero-foreground" : "text-on-surface-variant",
          )}
        >
          {placeholder}
        </span>
        <MarketingSearchIcon className="site-header-search-icon size-5" aria-hidden />
      </Button>
      {compactBelowDesktop ? (
        <MarketingChromeIconButton
          ref={compactTriggerRef}
          label="Search"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? shelfId : undefined}
          onClick={() => (open ? close(false) : openShelf(compactTriggerRef.current))}
          className={cn(
            "site-header-chrome site-header-chrome-icon bg-transparent lg:hidden",
            headerTone === "on-dark"
              ? "text-hero-foreground hover:bg-white/10"
              : "text-brand-800 hover:bg-page-bg dark:text-on-surface dark:hover:bg-surface-container-low",
          )}
        >
          <MarketingSearchIcon className="size-5" aria-hidden />
        </MarketingChromeIconButton>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={shelfRef}
              id={shelfId}
              // biome-ignore lint/a11y/useSemanticElements: a shelf fixed under the header (or a sheet on phones); a native dialog would need its UA styles and open state reset
              role="dialog"
              aria-label="Search"
              aria-modal={sheet ? true : undefined}
              data-search-layout={sheet ? "sheet" : "shelf"}
              className={cn(
                "fixed inset-x-0 z-40 bg-surface",
                sheet
                  ? "bottom-0 z-50 overflow-y-auto overscroll-contain"
                  : "max-h-[calc(100dvh-var(--search-shelf-top,0px))] overflow-y-auto border-b border-nav-border shadow-sm",
              )}
              style={{ top, ["--search-shelf-top" as string]: `${top}px` }}
            >
              <div
                className={cn(
                  "mx-auto flex max-w-[var(--container-max,90rem)]",
                  sheet ? "py-3" : "justify-end py-6",
                  MARKETING_PAGE_GUTTER_X,
                )}
              >
                <div className={cn("flex w-full flex-col", sheet ? "gap-5" : "max-w-xl gap-6")}>
                  <form
                    aria-label="Search"
                    onSubmit={onSubmit}
                    className="flex items-center gap-2 border-b border-on-surface/40 focus-within:border-on-surface"
                  >
                    {sheet ? (
                      <MarketingSearchIcon
                        className="size-5 shrink-0 text-on-surface-variant"
                        aria-hidden
                      />
                    ) : null}
                    <Input
                      ref={inputRef}
                      variant="underline"
                      name="q"
                      type="text"
                      enterKeyHint="search"
                      autoComplete="off"
                      aria-label={placeholder}
                      placeholder={placeholder}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onInputKeyDown}
                      className="h-11 flex-1 border-b-0"
                      {...(loadResults
                        ? {
                            role: "combobox",
                            "aria-autocomplete": "list" as const,
                            "aria-expanded": live,
                            "aria-controls": listboxId,
                            "aria-activedescendant": activeOption?.id,
                          }
                        : {})}
                    />
                    {sheet ? (
                      query ? (
                        <MarketingChromeIconButton
                          label="Clear search"
                          onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                          }}
                        >
                          <MarketingCloseIcon className="size-5" aria-hidden />
                        </MarketingChromeIconButton>
                      ) : null
                    ) : (
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
                    )}
                    {sheet ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "min-h-11 shrink-0 px-2 font-body text-sm font-medium text-on-surface",
                          FOCUS_RING,
                        )}
                        onClick={() => close(true)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </form>

                  {loadResults ? (
                    <output
                      aria-live="polite"
                      className={cn(
                        live
                          ? "block min-h-5 font-body text-sm text-on-surface-variant"
                          : "sr-only",
                      )}
                    >
                      {results.status === "loading" ? (
                        <span className="inline-flex items-center gap-2">
                          <MarketingSpinnerIcon className="size-4" aria-hidden />
                          {statusText}
                        </span>
                      ) : (
                        statusText
                      )}
                    </output>
                  ) : null}

                  {live ? (
                    // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox input, which points at the active option
                    <div
                      id={listboxId}
                      // biome-ignore lint/a11y/useSemanticElements: the combobox popup; options hold a thumbnail and two lines
                      role="listbox"
                      aria-label="Search suggestions"
                      className="flex flex-col gap-5"
                    >
                      {groups.map((group) => {
                        const titleId = `${optionPrefix}-${group.id}-title`;
                        return (
                          <div
                            key={group.id}
                            // biome-ignore lint/a11y/useSemanticElements: a group of combobox options, labelled by its heading
                            role="group"
                            aria-labelledby={titleId}
                            className="flex flex-col gap-1"
                          >
                            <div
                              id={titleId}
                              role="presentation"
                              className={cn(SECTION_TITLE, "px-2")}
                            >
                              {group.title}
                            </div>
                            {group.items.map((item) => {
                              const option = options.find(
                                (candidate) =>
                                  candidate.id === `${optionPrefix}-${group.id}-${item.id}`,
                              );
                              if (!option) return null;
                              const label = item.detail
                                ? `${item.label}, ${item.detail}`
                                : item.label;
                              return renderOption(
                                option,
                                <>
                                  {item.imageUrl !== undefined ? (
                                    <span
                                      className={cn(
                                        "relative size-12 shrink-0 overflow-hidden bg-surface-container-low",
                                        item.imageShape === "circle" && "rounded-full",
                                      )}
                                    >
                                      <MediaImage
                                        src={item.imageUrl}
                                        alt=""
                                        placeholderTitle={item.label}
                                        sizes="48px"
                                        shape={item.imageShape === "circle" ? "circle" : "rect"}
                                        imgClassName={
                                          item.imageShape === "circle"
                                            ? "object-cover"
                                            : "object-contain"
                                        }
                                      />
                                    </span>
                                  ) : null}
                                  <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-base font-medium">
                                      {item.label}
                                    </span>
                                    {item.detail ? (
                                      <span className="truncate text-sm text-on-surface-variant">
                                        {item.detail}
                                      </span>
                                    ) : null}
                                  </span>
                                </>,
                                label,
                              );
                            })}
                          </div>
                        );
                      })}
                      {searchAllOption
                        ? renderOption(
                            searchAllOption,
                            <>
                              <span className="flex size-12 shrink-0 items-center justify-center text-on-surface-variant">
                                <MarketingSearchIcon className="size-5" aria-hidden />
                              </span>
                              <span className="min-w-0 truncate text-base font-medium underline-offset-4">
                                See all results for “{trimmed}”
                              </span>
                            </>,
                            `See all results for “${trimmed}”`,
                          )
                        : null}
                    </div>
                  ) : null}

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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
