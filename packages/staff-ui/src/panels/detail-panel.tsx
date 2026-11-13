"use client";

import { type LinkComponent, useReturnFocus } from "@auction/ui/lax";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { ArrowUpRight, ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { type KeyValueItem, KeyValueList } from "../display/key-value-list.js";
import { discardPrompt } from "../forms/unsaved-changes.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { StaffTooltip } from "../primitives/menu.js";
import { MetaItem } from "../shell/page-header.js";
import { isTypingTarget, useStaffShortcut, useStaffShortcuts } from "../shell/shortcuts.js";
import type { PanelQueue } from "./queue-panel.js";
import { ConfirmActionDialog } from "./staff-dialog.js";

/** The way out of a panel to the record's page: the same words on every panel. */
export const OPEN_FULL_PAGE_LABEL = "Open full page";

const COUNT = new Intl.NumberFormat("en-GB");

/** The row a list marks as the open record (`DataTable` sets `data-active` on it). */
function activeTableRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>("tr[data-active]");
}

/** One key fact in a panel's meta line: "Buyer Ada Lovelace". */
export type PanelMetaFact = { label: string; value: React.ReactNode };

/**
 * `L` is the union of the summary's labels, so `headerFacts` can only name facts the summary
 * really has: a renamed summary label breaks the build instead of quietly showing a fact twice.
 */
export type DetailPanelProps<L extends string = string> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** A line under the title: who, how much, when. Prefer `meta` for facts. */
  description?: React.ReactNode;
  /** Status badge(s) beside the title. */
  status?: React.ReactNode;
  /**
   * The record's key facts under the title, the same line a record page shows: "Buyer Ada
   * Lovelace · Amount £4,140.00". A fact here is never repeated: a `summary` item with the same
   * label is left out of the summary.
   */
  meta?: readonly PanelMetaFact[];
  /** Header actions beside close. For the record's page, use `fullPage`. */
  headerActions?: React.ReactNode;
  /**
   * The record's full page, when it has one: "Open full page" (↗) first among the header
   * actions, in the same words on every panel.
   */
  fullPage?: { href: string; Link: LinkComponent };
  /**
   * A work queue (PRD-7, R2): the panel shows its place ("3 of 12") and steps to the previous
   * and next record with K and J, or the ↑ and ↓ buttons, without closing. `useQueuePanel`
   * builds it.
   */
  queue?: PanelQueue;
  /** An OverflowMenu (`…`) with the record's other actions, destructive last. */
  overflow?: React.ReactNode;
  /** A Notice about the whole record, above everything else in the panel. */
  notice?: React.ReactNode;
  /**
   * Key facts as a key-value list at the top of the panel, as on the record page. Facts already
   * in `meta` are dropped here.
   */
  summary?: readonly (KeyValueItem & { label: L })[];
  /**
   * Summary facts the header already shows: the title (the record's name), a status badge or the
   * line under the title. They are left out of the summary, as `meta` facts are, so a panel says
   * each fact once.
   */
  headerFacts?: readonly NoInfer<L>[];
  /** The record's activity (a Timeline), last in the panel under "Activity". */
  activity?: React.ReactNode;
  /** Sticky footer actions; the primary action last. */
  footer?: React.ReactNode;
  /** Wider for forms with side-by-side fields. */
  size?: "md" | "lg";
  /**
   * The panel holds a form with unsaved changes: closing it (close button, Escape, the scrim)
   * asks "Discard changes?" first.
   */
  dirty?: boolean;
  /** What is being edited, for "Discard changes to <label>?". */
  dirtyLabel?: string;
  children: React.ReactNode;
};

/**
 * Quick view and edit beside a list, without leaving it. Slides from the right at 480px (640px
 * for `lg`), full width on a phone. Focus moves into the panel on open and returns to the row
 * that opened it on close; Escape and the close button both close it.
 */
export function DetailPanel<L extends string = string>({
  open,
  onOpenChange,
  title,
  description,
  status,
  meta,
  headerActions,
  fullPage,
  queue,
  overflow,
  notice,
  summary,
  headerFacts,
  activity,
  footer,
  size = "md",
  dirty = false,
  dirtyLabel,
  children,
}: DetailPanelProps<L>) {
  const [confirmingClose, setConfirmingClose] = React.useState(false);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  // The list's row for the record shown, kept while the panel is open: the list unmarks it as
  // the panel closes, before focus comes back.
  const shownRow = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (open) shownRow.current = activeTableRow() ?? shownRow.current;
  });
  const rowShown = () => (shownRow.current?.isConnected ? shownRow.current : activeTableRow());
  // A panel opened from the URL, or after the list re-rendered, returns to the active row.
  const returnToOpener = useReturnFocus(open, rowShown);
  // A queue may have stepped on from the row that opened it: focus goes to the record last shown.
  const returnFocus = (event: Event) => {
    const row = queue ? rowShown() : null;
    if (!row) {
      returnToOpener(event);
      return;
    }
    event.preventDefault();
    row.focus({ preventScroll: true });
  };
  const shown = new Set<string>([
    ...(meta ?? []).map((fact) => fact.label),
    ...(headerFacts ?? []),
  ]);
  const summaryItems = (summary ?? []).filter((item) => !shown.has(item.label));
  const prompt = discardPrompt(dirtyLabel);
  const requestOpenChange = (next: boolean) => {
    if (!next && dirty) setConfirmingClose(true);
    else onOpenChange(next);
  };
  const stepping = useQueueStepping(open ? queue : undefined, dirty);
  const actions = fullPage || headerActions || overflow || queue;
  return (
    <>
      <Sheet open={open} onOpenChange={requestOpenChange}>
        <SheetContent
          {...STAFF_LAYER}
          side="right"
          overlayClassName="bg-staff-scrim"
          className={cn(
            "flex w-full max-w-none flex-col gap-0 border-l border-staff-line bg-staff-surface p-0 text-staff-fg shadow-staff-lg sm:max-w-none",
            size === "lg" ? "sm:w-[640px]" : "sm:w-[480px]",
            "[&>button:last-child]:hidden",
          )}
          // Focus starts on the title, as in a dialog: no ring on a header button until the
          // person presses Tab, and screen readers start with the record's name.
          onOpenAutoFocus={(event: Event) => {
            event.preventDefault();
            titleRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={returnFocus}
          onKeyDown={stepping.onKeyDown}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* On a phone the actions take their own row under the title, so the title keeps the
                width; from 640px they sit beside the close button. */}
            <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-staff-line px-5 py-4">
              <div className="order-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle
                    ref={titleRef}
                    tabIndex={-1}
                    className="font-staff text-staff-lg font-semibold text-staff-fg outline-none"
                  >
                    {title}
                  </SheetTitle>
                  {status}
                </div>
                {description ? (
                  <SheetDescription className="mt-1 text-staff-sm text-staff-muted">
                    {description}
                  </SheetDescription>
                ) : (
                  <SheetDescription className="sr-only">Details</SheetDescription>
                )}
                {(meta && meta.length > 0) || queue ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-staff-sm text-staff-muted">
                    {queue ? <QueuePosition queue={queue} /> : null}
                    {meta?.map((fact) => (
                      <MetaItem key={fact.label} label={fact.label}>
                        {fact.value}
                      </MetaItem>
                    ))}
                  </div>
                ) : null}
              </div>
              {actions ? (
                <div className="order-3 -ml-2 flex basis-full items-center gap-1 sm:order-2 sm:-mt-1 sm:ml-0 sm:basis-auto">
                  {queue ? <QueueStepButtons queue={queue} /> : null}
                  {fullPage ? (
                    <StaffButton
                      asChild
                      variant="ghost"
                      size="sm"
                      icon={<ArrowUpRight aria-hidden />}
                    >
                      <fullPage.Link href={fullPage.href}>{OPEN_FULL_PAGE_LABEL}</fullPage.Link>
                    </StaffButton>
                  ) : null}
                  {headerActions}
                  {overflow}
                </div>
              ) : null}
              <div className="order-2 -mt-1 -mr-2 flex shrink-0 items-center sm:order-3">
                <SheetClose asChild>
                  <StaffButton variant="ghost" size="icon-sm" aria-label="Close panel">
                    <X aria-hidden />
                  </StaffButton>
                </SheetClose>
              </div>
            </header>
            {/* Focusable so keyboard users can scroll a long panel without a pointer. */}
            <section
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must take focus to scroll by keyboard
              tabIndex={0}
              aria-label="Panel content"
              className="staff-focus-inset min-h-0 flex-1 overflow-y-auto px-5 py-5"
              data-lenis-prevent
            >
              {notice ? <div className="mb-6">{notice}</div> : null}
              {summaryItems.length > 0 ? (
                <PanelSection title="Summary">
                  <KeyValueList items={summaryItems} />
                </PanelSection>
              ) : null}
              {children}
              {activity ? <PanelSection title="Activity">{activity}</PanelSection> : null}
            </section>
            {/* The last row of the flex column, so it stays in view however long the panel; on a
                phone, clear of the home indicator. */}
            {footer ? (
              <footer
                data-staff-panel-footer=""
                className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-staff-line bg-staff-surface px-5 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))]"
              >
                {footer}
              </footer>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmActionDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        title={prompt.title}
        description={prompt.description}
        cancelLabel="Keep editing"
        confirmLabel={prompt.confirmLabel}
        tone="danger"
        onConfirm={() => {
          setConfirmingClose(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

/** "3 of 12" in the panel's meta line; said again when J or K moves to another record. */
function QueuePosition({ queue }: { queue: PanelQueue }) {
  return (
    <span
      data-staff-queue-position=""
      aria-live="polite"
      aria-atomic="true"
      className="tabular-nums"
    >
      <span className="text-staff-fg">{COUNT.format(queue.position)}</span> of{" "}
      {COUNT.format(queue.total)}
      <span className="sr-only"> in this queue</span>
    </span>
  );
}

function QueueStepButtons({ queue }: { queue: PanelQueue }) {
  const noun = queue.noun ?? "record";
  const button = (
    onStep: (() => void) | null,
    label: string,
    key: string,
    icon: React.ReactNode,
  ) => (
    <StaffTooltip label={label} shortcut={key}>
      <StaffButton
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-keyshortcuts={key}
        // Stays focusable at the ends, so focus is not lost when the last record is reached.
        aria-disabled={onStep ? undefined : true}
        className={cn(!onStep && "opacity-50")}
        onClick={() => onStep?.()}
      >
        {icon}
      </StaffButton>
    </StaffTooltip>
  );
  return (
    <div className="flex items-center">
      {button(queue.onPrevious, `Previous ${noun}`, "K", <ChevronUp aria-hidden />)}
      {button(queue.onNext, `Next ${noun}`, "J", <ChevronDown aria-hidden />)}
    </div>
  );
}

/**
 * J and K step through the queue while the panel is open. Through the shell's shortcut registry
 * when there is one (so the `?` sheet lists them, they take over the list's own J and K, and the
 * person's "single-key shortcuts off" is respected); otherwise on the panel itself. Never while
 * typing, and never away from unsaved changes.
 */
function useQueueStepping(queue: PanelQueue | undefined, dirty: boolean) {
  const registry = useStaffShortcuts();
  const live = queue && !dirty ? queue : undefined;
  const noun = queue?.noun ?? "record";
  useStaffShortcut(
    registry && live
      ? {
          id: "staff:panel-next",
          keys: "j",
          label: `Next ${noun}`,
          group: "Panels",
          handler: () => live.onNext?.(),
        }
      : null,
  );
  useStaffShortcut(
    registry && live
      ? {
          id: "staff:panel-previous",
          keys: "k",
          label: `Previous ${noun}`,
          group: "Panels",
          handler: () => live.onPrevious?.(),
        }
      : null,
  );
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (registry || !live || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const step = event.key === "j" ? live.onNext : event.key === "k" ? live.onPrevious : undefined;
    if (step === undefined) return;
    event.preventDefault();
    step?.();
  };
  return { onKeyDown };
}

/** A labelled block inside a panel: small heading, content below, 24px apart from the next. */
export function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 not-first:mt-6">
      <div className="flex min-h-control-xs items-center justify-between gap-2">
        <h3 className="text-staff-xs font-medium text-staff-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
