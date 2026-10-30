"use client";

import { useReturnFocus } from "@auction/ui/lax";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { X } from "lucide-react";
import * as React from "react";
import { type KeyValueItem, KeyValueList } from "../display/key-value-list.js";
import { discardPrompt } from "../forms/unsaved-changes.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { MetaItem } from "../shell/page-header.js";
import { ConfirmActionDialog } from "./staff-dialog.js";

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
  /** Header actions beside close, e.g. "Open full page". */
  headerActions?: React.ReactNode;
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
  // A panel opened from the URL, or after the list re-rendered, returns to the active row.
  const returnFocus = useReturnFocus(open, activeTableRow);
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
                {meta && meta.length > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-staff-sm text-staff-muted">
                    {meta.map((fact) => (
                      <MetaItem key={fact.label} label={fact.label}>
                        {fact.value}
                      </MetaItem>
                    ))}
                  </div>
                ) : null}
              </div>
              {headerActions || overflow ? (
                <div className="order-3 -ml-2 flex basis-full items-center gap-1 sm:order-2 sm:-mt-1 sm:ml-0 sm:basis-auto">
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
            {footer ? (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-staff-line bg-staff-surface px-5 py-3">
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
