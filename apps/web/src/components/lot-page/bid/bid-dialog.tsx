"use client";

import { BidDialogNotice } from "@/components/lot-page/bid/bid-dialog-notice";
import type { BidDialogConfirm, BidDialogSummary } from "@/lib/lot-page/bid-dialog/bid-dialog-view";
import {
  type BidDialogController,
  type PlacedBidResult,
  type UseBidDialogInput,
  useBidDialog,
} from "@/lib/lot-page/bid-dialog/use-bid-dialog";
import type { BidMode } from "@auction/domain";
import {
  Button,
  Dialog,
  DialogClose,
  Field,
  NativeSelect,
  Notice,
  PresetCards,
} from "@auction/ui/lax";
import Link from "next/link";
import { type ReactNode, useEffect, useId, useRef } from "react";

export type LotBidDialogProps = Omit<UseBidDialogInput, "start" | "onPlaced"> & {
  open: boolean;
  /** Changes each time the dialog is opened, so every opening starts from the lot as it is now. */
  session: number;
  start: BidMode;
  onOpenChange: (open: boolean) => void;
  onPlaced: (result: PlacedBidResult) => void;
  /** Where an unregistered bidder goes to register; `null` when there is no registration page. */
  registerHref: string | null;
  /** Where focus goes on closing if the button that opened the dialog has been replaced. */
  returnFocusFallback?: () => HTMLElement | null;
};

function SummaryBlock({ summary }: { summary: BidDialogSummary }) {
  return (
    <div className="grid gap-1.5 rounded-lax-card bg-lax-sunken px-4 py-3 text-lax-13 leading-5">
      <dl className="m-0 grid gap-1.5">
        {summary.rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-lax-muted">{row.label}</dt>
            <dd className="m-0 tabular-nums text-lax-fg">{row.value}</dd>
          </div>
        ))}
        <div className="mt-0.5 flex justify-between gap-4 border-t border-lax-line pt-2 text-lax-14 font-semibold">
          <dt className="text-lax-fg">{summary.total.label}</dt>
          <dd className="m-0 tabular-nums text-lax-fg">{summary.total.value}</dd>
        </div>
      </dl>
      <p className="m-0 text-lax-12 leading-4 text-lax-muted">{summary.fine}</p>
    </div>
  );
}

/** One row per kind of confirm, so a new state of the button is a new row. */
const CONFIRM_BUTTON: Readonly<{
  [K in BidDialogConfirm["kind"]]: (
    confirm: Extract<BidDialogConfirm, { kind: K }>,
    props: { onConfirm: () => void; describedBy: string | undefined },
  ) => ReactNode;
}> = {
  none: () => null,
  ready: (confirm, { onConfirm, describedBy }) => (
    <Button variant="primary" size="md" onClick={onConfirm} aria-describedby={describedBy}>
      {confirm.label}
    </Button>
  ),
  retry: (confirm, { onConfirm, describedBy }) => (
    <Button variant="primary" size="md" onClick={onConfirm} aria-describedby={describedBy}>
      {confirm.label}
    </Button>
  ),
  submitting: (confirm) => (
    <Button variant="primary" size="md" loading>
      {confirm.label}
    </Button>
  ),
  disabled: (confirm, { describedBy }) => (
    <Button
      variant="primary"
      size="md"
      disabledReason={confirm.reason}
      aria-describedby={describedBy}
    >
      {confirm.label}
    </Button>
  ),
};

function ConfirmButton({
  confirm,
  onConfirm,
  describedBy,
}: {
  confirm: BidDialogConfirm;
  onConfirm: () => void;
  describedBy: string | undefined;
}) {
  const build = CONFIRM_BUTTON[confirm.kind] as (
    confirm: BidDialogConfirm,
    props: { onConfirm: () => void; describedBy: string | undefined },
  ) => ReactNode;
  return build(confirm, { onConfirm, describedBy });
}

/** The body and the footer of one opening of the dialog. */
function BidDialogSession({
  open,
  onOpenChange,
  registerHref,
  returnFocusFallback,
  start,
  onPlaced,
  ...input
}: Omit<LotBidDialogProps, "session">) {
  const noticeId = useId();
  const focusRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const controller: BidDialogController = useBidDialog({ ...input, start, onPlaced });
  const { view } = controller;

  // When the only thing left to do is close (bidding ended), focus rests on Close.
  const confirmGone = view.confirm.kind === "none";
  useEffect(() => {
    if (confirmGone) cancelRef.current?.focus();
  }, [confirmGone]);

  const busy = controller.submitting;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A bid on its way cannot be abandoned from the dialog.
        if (!next && busy) return;
        onOpenChange(next);
      }}
      title={view.title}
      description={view.description}
      initialFocusRef={focusRef}
      {...(returnFocusFallback ? { returnFocusFallback } : {})}
      footer={
        <>
          <DialogClose asChild>
            <Button ref={cancelRef} variant="secondary" size="md" disabled={busy}>
              {view.cancelLabel}
            </Button>
          </DialogClose>
          <ConfirmButton
            confirm={view.confirm}
            onConfirm={controller.confirm}
            describedBy={view.notice ? noticeId : undefined}
          />
        </>
      }
    >
      <div className="grid gap-4 pt-1">
        {view.notice ? (
          <BidDialogNotice
            id={noticeId}
            notice={view.notice}
            format={input.format}
            registerHref={registerHref}
            onUseAmount={controller.applyAmount}
          />
        ) : null}
        {view.accountNote ? (
          <Notice tone="info" title={view.accountNote.title}>
            {view.accountNote.detail}
          </Notice>
        ) : null}
        {view.options ? (
          <PresetCards
            label="Bid type"
            columns={1}
            compact
            value={controller.mode}
            checkedRef={focusRef as React.Ref<HTMLButtonElement>}
            onValueChange={controller.chooseMode}
            options={view.options.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.description,
            }))}
          />
        ) : (
          <p className="m-0 text-lax-13 leading-5 text-lax-muted">
            We bid for you from the opening, one step at a time, only as much as needed to keep you
            ahead.
          </p>
        )}
        {view.maximum ? (
          <div
            ref={(node) => {
              // With no choice of bid type, focus opens on the maximum itself.
              if (!view.options) focusRef.current = node?.querySelector("select") ?? null;
            }}
          >
            <Field label="Your maximum">
              <NativeSelect
                value={view.maximum.value ?? ""}
                disabled={busy}
                onValueChange={controller.chooseMaximum}
                options={view.maximum.choices}
              />
            </Field>
          </div>
        ) : null}
        {view.summary ? <SummaryBlock summary={view.summary} /> : null}
        {view.confirm.kind !== "none" ? (
          <p className="m-0 -mt-1 text-lax-12 leading-4 text-lax-muted">
            By bidding you agree to the{" "}
            <Link href="/terms" className="text-lax-fg underline underline-offset-2">
              conditions of business
            </Link>
            .
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * The one place to bid: a dialog on a computer and a sheet on a phone, with the two ways to bid,
 * the summary of what winning costs and an honest answer to every refusal. Each opening starts
 * from the lot as it is then; the amount never changes without the bidder seeing it.
 */
export function LotBidDialog({ session, ...props }: LotBidDialogProps) {
  return <BidDialogSession key={session} {...props} />;
}
