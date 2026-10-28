"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { FIELD } from "@/components/account-ui";
import { requestSaleChangeAction } from "@/server/application/selling-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  MIN_AVAILABLE_TO_SELL,
  SALE_REQUEST_NOTE_MAX,
  clampAvailableToSell,
  describeSaleRequestDraft,
} from "@/server/domain/selling/selling-editions.vm";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import { cn } from "@auction/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@auction/ui/components/dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

function StepIcon({ kind }: { kind: "minus" | "plus" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d={kind === "plus" ? "M4 10h12M10 4v12" : "M4 10h12"} />
    </svg>
  );
}

export type SaleRequestDialogProps = {
  artworkId: string;
  artworkTitle: string;
  /** Editions available to sell now; the stepper starts one above it. */
  current: number;
  /** The most that can be available: the prints the seller holds, less those sold or reserved. */
  max: number;
  triggerLabel: string;
  /** Opens the dialog on first render; used to show the dialog on its own. */
  defaultOpen?: boolean;
};

/**
 * Asks LAX for a different number of editions available to sell, from the artwork's row. The
 * stepper sets the new total and says how it compares with now; an optional note goes to the
 * staff who answer. The row shows the pending request once it is sent.
 */
export function SaleRequestDialog({
  artworkId,
  artworkTitle,
  current,
  max,
  triggerLabel,
  defaultOpen = false,
}: SaleRequestDialogProps) {
  const router = useRouter();
  const countId = useId();
  const noteId = useId();
  const hintId = `${countId}-hint`;
  const errorId = `${countId}-error`;
  const initial = clampAvailableToSell(current >= max ? current - 1 : current + 1, max);
  const [open, setOpen] = useState(defaultOpen);
  const [count, setCount] = useState(initial);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draft = describeSaleRequestDraft(count, current, max);

  function reset(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setCount(initial);
      setNote("");
      setError(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.canSubmit) return;
    setError(null);
    startTransition(async () => {
      const trimmed = note.trim();
      const result = await requestSaleChangeAction({
        artworkId,
        requestedCount: count,
        ...(trimmed ? { note: trimmed } : {}),
      });
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(SELLING_ROUTES.editions));
        return;
      }
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" aria-label={`${triggerLabel} for ${artworkTitle}`}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-md gap-6 rounded-2xl border-border-hairline bg-surface p-6 sm:rounded-2xl"
        closeClassName="flex size-11 items-center justify-center top-3 right-3 rounded-md focus-visible:ring-ring"
      >
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <DialogHeader className="gap-1 pr-8 text-left">
            <DialogTitle className="font-headline text-xl leading-7">{draft.title}</DialogTitle>
            <DialogDescription>
              {artworkTitle}. You can sell {current} {current === 1 ? "edition" : "editions"} now.
              LAX reviews each request.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={countId} className="text-sm font-medium text-on-surface">
              Editions available to sell
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-md border-control-border"
                aria-label="One fewer"
                aria-controls={countId}
                disabled={pending || count <= MIN_AVAILABLE_TO_SELL}
                onClick={() => setCount((value) => clampAvailableToSell(value - 1, max))}
              >
                <StepIcon kind="minus" />
              </Button>
              <Input
                id={countId}
                type="number"
                inputMode="numeric"
                min={MIN_AVAILABLE_TO_SELL}
                max={max}
                step={1}
                value={count}
                disabled={pending}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value !== "") setCount(clampAvailableToSell(value, max));
                }}
                className={cn(
                  FIELD,
                  "w-20 rounded-md text-center font-headline text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-md border-control-border"
                aria-label="One more"
                aria-controls={countId}
                disabled={pending || count >= max}
                onClick={() => setCount((value) => clampAvailableToSell(value + 1, max))}
              >
                <StepIcon kind="plus" />
              </Button>
            </div>
            <p id={hintId} aria-live="polite" className="text-sm text-on-surface-variant">
              {draft.changeText}. Between {MIN_AVAILABLE_TO_SELL} and {max}, the{" "}
              {max === 1 ? "print" : "prints"} you hold that are not sold or reserved.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <Label htmlFor={noteId} className="text-sm font-medium text-on-surface">
                Note for LAX <span className="font-normal text-on-surface-variant">(optional)</span>
              </Label>
              <span className="text-xs tabular-nums text-on-surface-variant" aria-hidden="true">
                {note.length}/{SALE_REQUEST_NOTE_MAX}
              </span>
            </div>
            <Textarea
              id={noteId}
              rows={3}
              maxLength={SALE_REQUEST_NOTE_MAX}
              value={note}
              disabled={pending}
              placeholder="For example, why you'd like to sell more now"
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 rounded-md border-control-border bg-surface text-sm hover:border-on-surface-variant"
            />
          </div>

          {error ? (
            <p id={errorId} role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-3 sm:space-x-0">
            <Button type="button" variant="outline" disabled={pending} onClick={() => reset(false)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              variant="cta"
              loading={pending}
              loadingLabel="Sending…"
              disabled={!draft.canSubmit}
            >
              {draft.submitLabel}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
