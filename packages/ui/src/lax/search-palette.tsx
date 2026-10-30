"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, CornerDownLeft, LoaderCircle, Lock, Search } from "lucide-react";
import * as React from "react";
import { LaxIllustration } from "../components/ui/lax-illustration.js";
import { cn } from "../lib/utils.js";
import { useLayerAttributes } from "./density.js";
import { Kbd, ShortcutKeys } from "./kbd.js";
import { useReturnFocus } from "./return-focus.js";

export type PaletteItem = {
  id: string;
  label: string;
  /** One muted line: "Lot 57 · won · payment overdue". */
  meta?: string;
  /** A 32px thumbnail or a 16px icon before the label. */
  media?: React.ReactNode;
  /** A "Go to" key sequence shown on the right: "g b". */
  shortcut?: string;
};

export type PaletteGroup = { id: string; label: string; items: readonly PaletteItem[] };

export type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Names the account searched: "Search Northbank Gallery". */
  placeholder: string;
  /** The results, grouped by type; before typing, the recent items, pages and actions. */
  groups: readonly PaletteGroup[];
  onSelect: (item: PaletteItem) => void;
  /** `loading` while results are on their way; `error` when they could not be fetched. */
  status?: "ready" | "loading" | "error";
  /** Shown when there is nothing to show before typing (a new account). */
  emptyState?: { title: string; description: string };
  /** What a role's narrower search leaves out, under the results. */
  scopeNote?: React.ReactNode;
};

type Flat = { item: PaletteItem; optionId: string };

/**
 * Search across the account the person is acting for, from ⌘K, / or the field in the bar. It
 * follows the WAI-ARIA combobox pattern: the field is a combobox that controls a listbox of
 * grouped options, the arrow keys move the active option (announced through
 * `aria-activedescendant` while focus stays in the field), Enter opens it and Escape closes the
 * palette and returns focus to whatever opened it. The results come in through props, so the
 * page decides what the role may see. On a phone it fills the screen with a back button.
 */
export function SearchPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  placeholder,
  groups,
  onSelect,
  status = "ready",
  emptyState,
  scopeNote,
}: SearchPaletteProps) {
  const layer = useLayerAttributes();
  const returnFocus = useReturnFocus(open);
  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;
  const flat = React.useMemo<Flat[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({ item, optionId: `${baseId}-${group.id}-${item.id}` })),
      ),
    [groups, baseId],
  );
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const signature = flat.map((entry) => entry.optionId).join("|");

  // A new set of results starts again at the first one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature stands for the results
  React.useEffect(() => setActive(0), [signature]);

  const activeEntry = flat[Math.min(active, flat.length - 1)];

  React.useEffect(() => {
    if (!activeEntry) return;
    document.getElementById(activeEntry.optionId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeEntry]);

  const choose = (item: PaletteItem) => {
    onSelect(item);
    onOpenChange(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter" && activeEntry) {
      event.preventDefault();
      choose(activeEntry.item);
    }
  };

  const typed = query.trim().length > 0;
  const nothing = flat.length === 0;
  const announcement =
    status === "loading"
      ? "Searching"
      : typed
        ? nothing
          ? `No results for ${query.trim()}`
          : `${flat.length} ${flat.length === 1 ? "result" : "results"}`
        : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          {...layer}
          className="fixed inset-0 z-[var(--z-overlay,60)] bg-lax-scrim max-md:hidden"
        />
        <DialogPrimitive.Content
          {...layer}
          onCloseAutoFocus={returnFocus}
          aria-label={placeholder}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // Focus goes straight to the field, past the phone's back button.
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "fixed z-[var(--z-overlay,60)] flex flex-col overflow-hidden bg-lax-raised text-lax-fg outline-none",
            "inset-0 pt-[env(safe-area-inset-top,0px)]",
            "md:inset-x-auto md:top-[12vh] md:bottom-auto md:left-1/2 md:max-h-[min(560px,76vh)] md:w-[calc(100%-4rem)] md:max-w-[640px] md:-translate-x-1/2 md:rounded-lax-card md:border md:border-lax-line md:pt-0 md:shadow-lax-lg",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{placeholder}</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-lax-line px-2 md:px-4">
            <DialogPrimitive.Close
              aria-label="Close search"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lax-control text-lax-fg hover:bg-lax-hover lax-focus md:hidden"
            >
              <ArrowLeft aria-hidden className="size-5" />
            </DialogPrimitive.Close>
            <Search aria-hidden className="size-4 shrink-0 text-lax-muted max-md:hidden" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={!nothing}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-label={placeholder}
              {...(activeEntry ? { "aria-activedescendant": activeEntry.optionId } : {})}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 bg-transparent text-lax-16 text-lax-fg outline-none placeholder:text-lax-muted md:h-full md:text-lax-14"
            />
            {status === "loading" ? (
              <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-lax-muted" />
            ) : null}
            <Kbd className="max-md:hidden">Esc</Kbd>
          </div>

          <div
            // The results scroll on their own, so the region must be reachable with Tab.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable (WCAG 2.1.1)
            tabIndex={0}
            className="lax-focus-inset min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {
              // biome-ignore lint/a11y/useFocusableInteractive: the WAI-ARIA combobox pattern: focus stays in the field and aria-activedescendant points here
              <div
                id={listboxId}
                // biome-ignore lint/a11y/useSemanticElements: the combobox popup; options hold a thumbnail and two lines
                role="listbox"
                aria-label="Results"
                aria-busy={status === "loading" || undefined}
                // With nothing to offer the list is closed, and out of the accessibility tree.
                hidden={nothing}
              >
                {groups.map((group) =>
                  group.items.length === 0 ? null : (
                    <div
                      key={group.id}
                      // biome-ignore lint/a11y/useSemanticElements: a group of combobox options, labelled by its heading
                      role="group"
                      aria-labelledby={`${baseId}-${group.id}-label`}
                      className="pb-2"
                    >
                      <div
                        id={`${baseId}-${group.id}-label`}
                        role="presentation"
                        className="px-2 pt-2 pb-1 text-lax-12 font-medium text-lax-muted"
                      >
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const optionId = `${baseId}-${group.id}-${item.id}`;
                        const index = flat.findIndex((entry) => entry.optionId === optionId);
                        const selected = index === active;
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: the field handles the keys; focus stays there and aria-activedescendant points here
                          <div
                            key={item.id}
                            id={optionId}
                            // biome-ignore lint/a11y/useSemanticElements: a combobox option holds a thumbnail and two lines, which a native option cannot
                            role="option"
                            aria-selected={selected}
                            tabIndex={-1}
                            onMouseMove={() => setActive(index)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(item)}
                            className={cn(
                              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lax-menu px-2 py-1",
                              selected && "bg-lax-selected",
                            )}
                          >
                            {item.media ? (
                              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lax-badge bg-lax-paper text-lax-muted [&_svg]:size-4 [&>img]:size-full [&>img]:object-cover">
                                {item.media}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-lax-14 font-medium">
                                {item.label}
                              </span>
                              {item.meta ? (
                                <span className="block truncate text-lax-12 text-lax-muted">
                                  {item.meta}
                                </span>
                              ) : null}
                            </span>
                            {item.shortcut ? (
                              <ShortcutKeys
                                keys={item.shortcut}
                                className="shrink-0 max-md:hidden"
                              />
                            ) : selected ? (
                              <Kbd className="shrink-0 max-md:hidden">
                                <CornerDownLeft aria-hidden className="size-3" />
                                <span className="sr-only">Enter</span>
                              </Kbd>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ),
                )}
              </div>
            }

            {nothing && status !== "loading" ? (
              <PaletteEmpty
                {...(status === "error"
                  ? {
                      title: "Search isn't available right now",
                      description: "Try again in a moment. Everything is still in the menu.",
                    }
                  : typed
                    ? {
                        title: `No results for "${query.trim()}"`,
                        description: "Try an artist, title, lot, reference or invoice number.",
                      }
                    : (emptyState ?? {
                        title: placeholder,
                        description: "Type to search.",
                      }))}
              />
            ) : null}

            {scopeNote && !nothing ? (
              <p className="mx-2 mt-1 flex items-start gap-2 rounded-lax-menu bg-lax-sunken px-3 py-2 text-lax-12 text-lax-muted">
                <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {scopeNote}
              </p>
            ) : null}
          </div>

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>

          <div className="flex h-10 shrink-0 items-center gap-4 border-t border-lax-line px-4 text-lax-12 text-lax-muted max-md:hidden">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft aria-hidden className="size-3" />
                <span className="sr-only">Enter</span>
              </Kbd>
              open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="mb-1 grid h-16 w-20 place-items-center rounded-lax-menu bg-lax-paper text-lax-fg">
        <LaxIllustration name="search" size="compact" className="w-14 text-current" />
      </span>
      <p className="text-lax-14 font-semibold text-lax-fg">{title}</p>
      <p className="max-w-80 text-lax-13 text-lax-muted">{description}</p>
    </div>
  );
}

/** Whether a key press is someone typing, so "/" never steals a field's input. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** Opens the palette on ⌘K (Ctrl K off a Mac) from anywhere, and on / outside a field. */
export function useSearchPaletteShortcut(onOpen: () => void): void {
  const latest = React.useRef(onOpen);
  latest.current = onOpen;
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (modK || (slash && !isTyping(event.target))) {
        event.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
