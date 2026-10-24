"use client";

import { Button } from "@/components/account-button";
import { FIELD } from "@/components/account-ui";
import {
  type FilterChange,
  type FilterFieldVm,
  type FilterSearchVm,
  activeFilterChips,
  filterHref,
  singularOf,
} from "@/lib/filter-query";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { useMinWidthMd } from "@auction/ui/hooks/use-media-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

/** Radix radio items need a non-empty value, so "any" is stood for by this word. */
const ANY = "__any";
const SEARCH_DELAY_MS = 400;

export type FilterToolbarProps = {
  /** The page's own path; filters are written to its query string. */
  action: string;
  /** What is being filtered, as a plural: "works", "money entries". Used in the panel title. */
  noun: string;
  search?: FilterSearchVm;
  fields: readonly FilterFieldVm[];
  /** How many rows match now, and how many exist before any filter. */
  shown: number;
  total: number;
};

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="m2.5 2.5 7 7m0-7-7 7" />
    </svg>
  );
}

/**
 * One radio group per filter, "Any" first. Choosing applies at once, so the results behind the
 * panel are already right when it closes.
 */
export function FilterPanelFields({
  fields,
  onChoose,
}: {
  fields: readonly FilterFieldVm[];
  onChoose: (name: string, value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      {fields
        .filter((field) => field.options.length > 0)
        .map((field) => {
          const headingId = `${id}-${field.name}`;
          return (
            <section key={field.name} className="flex flex-col gap-1">
              <h3 id={headingId} className="text-sm font-semibold text-on-surface">
                {field.label}
              </h3>
              <RadioGroup
                aria-labelledby={headingId}
                value={field.value || ANY}
                onValueChange={(next) => onChoose(field.name, next === ANY ? "" : next)}
                className="gap-0"
              >
                {[{ value: ANY, label: "Any" }, ...field.options].map((option) => {
                  const itemId = `${id}-${field.name}-${option.value}`;
                  return (
                    <label
                      key={option.value}
                      htmlFor={itemId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-on-surface"
                    >
                      <RadioGroupItem
                        id={itemId}
                        value={option.value}
                        className="size-5 border-on-surface-variant"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </RadioGroup>
            </section>
          );
        })}
    </div>
  );
}

/** What is applied, each removable, with a way to drop them all. */
export function ActiveFilterChips({
  fields,
  canClearAll,
  onRemove,
  onClearAll,
}: {
  fields: readonly FilterFieldVm[];
  canClearAll: boolean;
  onRemove: (name: string) => void;
  onClearAll: () => void;
}) {
  const chips = activeFilterChips(fields);
  if (chips.length === 0 && !canClearAll) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Active filters" className="contents">
        {chips.map((chip) => (
          <li key={chip.name}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemove(chip.name)}
              aria-label={`Remove ${chip.group} filter: ${chip.text}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-product-accent bg-product-accent/10 px-3.5 text-sm font-medium text-on-surface transition-colors hover:bg-product-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {chip.text}
              <RemoveIcon />
            </Button>
          </li>
        ))}
      </ul>
      {canClearAll ? (
        <Button
          type="button"
          variant="link"
          size="inline"
          onClick={onClearAll}
          className="px-2 underline"
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Search, a Filter button and the filters applied. The Filter button opens a panel: a side sheet
 * on a wide screen and a bottom sheet on a phone. The state is the URL query, so choosing
 * something navigates in place: the server page re-renders with the new results, Back steps
 * through the choices, and nothing reloads.
 */
export function FilterToolbar({ action, noun, search, fields, shown, total }: FilterToolbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isWide = useMinWidthMd();
  const filterButton = useRef<HTMLButtonElement>(null);
  const searchId = useId();

  const [draft, setDraft] = useState(search?.value ?? "");
  const searchValue = search?.value ?? "";
  const hasSearchBox = search !== undefined;
  // The search text this toolbar last put in the URL, so the box is not rewound to it while the
  // person keeps typing.
  const sent = useRef(searchValue);

  // Back, or a chip, changes the URL's search text from outside; the box follows it.
  useEffect(() => {
    if (searchValue !== sent.current) setDraft(searchValue);
    sent.current = searchValue;
  }, [searchValue]);

  function go(change: FilterChange, mode: "push" | "replace" = "push") {
    if (change.kind === "search") sent.current = change.value.trim();
    const href = filterHref(action, fields, search, change);
    startTransition(() => {
      if (mode === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }
  const goRef = useRef(go);
  goRef.current = go;

  // Typing searches after a short pause, replacing the history entry so Back is not buried in
  // one entry per keystroke.
  useEffect(() => {
    if (!hasSearchBox || draft.trim() === sent.current) return;
    const timer = setTimeout(
      () => goRef.current({ kind: "search", value: draft }, "replace"),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, hasSearchBox]);

  const activeCount = fields.filter((field) => field.value).length;
  const hasSearch = Boolean(searchValue);
  const countText = `Showing ${shown} of ${total} ${noun}`;

  function removeChip(name: string) {
    go({ kind: "field", name, value: "" });
    // The chip that was pressed is about to disappear, so keep focus somewhere that stays.
    filterButton.current?.focus();
  }

  function clearAll() {
    setDraft("");
    go({ kind: "clear" });
    filterButton.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {search ? (
          // biome-ignore lint/a11y/useSemanticElements: a form with role="search" is the standard search landmark.
          <form
            role="search"
            method="get"
            action={action}
            className="relative min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              go({ kind: "search", value: draft });
            }}
          >
            {fields
              .filter((field) => field.value)
              .map((field) => (
                <Input key={field.name} type="hidden" name={field.name} value={field.value} />
              ))}
            <label htmlFor={searchId} className="sr-only">
              {search.label}
            </label>
            <SearchIcon />
            <Input
              id={searchId}
              type="search"
              name={search.name}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={search.placeholder}
              autoComplete="off"
              enterKeyHint="search"
              className={cn(FIELD, "pl-9")}
            />
          </form>
        ) : null}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button ref={filterButton} type="button" variant="outline" className="shrink-0 gap-2">
              Filter
              {activeCount > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-cta-bg px-1.5 text-xs font-semibold text-cta-on"
                  >
                    {activeCount}
                  </span>
                  <span className="sr-only">, {activeCount} applied</span>
                </>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isWide ? "right" : "bottom"}
            className={isWide ? "flex w-full max-w-md flex-col gap-0 bg-surface p-0" : "bg-surface"}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col gap-1 px-6 pt-6 pr-16 pb-5">
                <SheetTitle className="font-headline">Filter {noun}</SheetTitle>
                <SheetDescription>Results update as you choose.</SheetDescription>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                <FilterPanelFields
                  fields={fields}
                  onChoose={(name, value) => go({ kind: "field", name, value })}
                />
              </div>
              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border-hairline bg-surface px-6 py-4">
                {activeCount > 0 || hasSearch ? (
                  <Button
                    type="button"
                    variant="link"
                    size="inline"
                    onClick={() => go({ kind: "clear" })}
                    className="underline"
                  >
                    Clear all
                  </Button>
                ) : (
                  <span />
                )}
                <SheetClose asChild>
                  <Button type="button" variant="cta">
                    Show {shown} {shown === 1 ? singularOf(noun) : noun}
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <ActiveFilterChips
        fields={fields}
        canClearAll={activeCount > 0 || hasSearch}
        onRemove={removeChip}
        onClearAll={clearAll}
      />
      <output aria-busy={pending} className="block text-sm text-on-surface-variant">
        {pending ? "Updating results…" : countText}
      </output>
    </div>
  );
}
