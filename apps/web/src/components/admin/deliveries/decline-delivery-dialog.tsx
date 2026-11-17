"use client";

import { declineDeliveryAction } from "@/lib/actions/admin/admin-deliveries";
import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { deliveryLotTitle } from "@/lib/admin/deliveries/deliveries.vm";
import {
  DECLINE_REASON_MAX,
  isStaleDecline,
  validateDeclineReason,
} from "@/lib/admin/deliveries/delivery-decline";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { Field, Notice, StaffButton, StaffFormDialog, TextArea } from "@auction/staff-ui";
import { useEffect, useRef, useState } from "react";

const COPY = DELIVERIES_COPY.decline;

/** The server action the dialog calls; injectable so the flow can be tested on its own. */
export type DeclineDeliveryApi = { decline: typeof declineDeliveryAction };
const SERVER_ACTIONS: DeclineDeliveryApi = { decline: declineDeliveryAction };

type Failure = { stale: boolean; message: string };

/**
 * "Can't deliver" (D5, D8): the panel footer's button and its dialog, for a request in Waiting for
 * a price or Quote sent. The dialog asks for one thing, the reason the buyer is emailed, so a
 * missing or long reason is said under the field (no error summary for one field).
 *
 * The decline names the request staff are looking at (its quote id and status), so a buyer who
 * withdrew and asked again, or a colleague who priced it meanwhile, gets the D6 stale Notice in
 * the dialog, and the panel reloads, instead of a reason sent for a request nobody saw. A double
 * submit of the same reason reuses one Idempotency-Key, so the buyer gets one email.
 *
 * Focus: the dialog opens on the reason and returns to the button on Cancel. Once declined the
 * button is gone (the request is closed), so focus moves to the panel's title.
 */
export function DeclineDeliveryAction({
  row,
  onDeclined,
  onStale,
  api = SERVER_ACTIONS,
}: {
  row: Pick<DeliveryView, "lotId" | "quoteId" | "quote" | "lot">;
  /** After a decline: reload the list and panel. */
  onDeclined: () => void;
  /** The request moved on: reload so the panel shows it as it is now. */
  onStale: () => void;
  api?: DeclineDeliveryApi;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const panelTitle = useRef<HTMLElement | null>(null);
  const sent = useRef<{ body: string; key: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const lot = deliveryLotTitle(row.lot);

  // When the request closes the button goes away; focus would fall to the page, so it moves to
  // the panel's title, where it started.
  useEffect(() => {
    const button = buttonRef.current;
    panelTitle.current =
      button?.closest('[role="dialog"]')?.querySelector<HTMLElement>('[tabindex="-1"]') ?? null;
    return () => {
      // Still on the page (a development re-run of effects): nothing to move.
      if (button?.isConnected) return;
      const active = typeof document === "undefined" ? null : document.activeElement;
      if (active && active !== document.body) return;
      const title = panelTitle.current;
      if (title?.isConnected) title.focus({ preventScroll: true });
    };
  }, []);

  const error = attempted ? validateDeclineReason(reason) : null;

  const openDialog = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setReason("");
    setAttempted(false);
    setFailure(null);
    sent.current = null;
  };

  async function submit() {
    setAttempted(true);
    if (validateDeclineReason(reason)) {
      reasonRef.current?.focus();
      return;
    }
    const body = {
      quoteId: row.quoteId,
      expectedStatus: row.quote.status,
      reason: reason.trim(),
    };
    const fingerprint = JSON.stringify(body);
    // The same reason resent (a retry after "didn't answer") keeps its key, so it declines once;
    // an edited reason is a new request with a new key.
    if (sent.current?.body !== fingerprint) {
      sent.current = { body: fingerprint, key: crypto.randomUUID() };
    }
    setFailure(null);
    setPending(true);
    const result = await api.decline(row.lotId, body, sent.current.key).catch(() => null);
    setPending(false);
    if (result?.ok) {
      setOpen(false);
      onDeclined();
      return;
    }
    const stale = isStaleDecline(result?.errorCode);
    setFailure({ stale, message: result?.error ?? COPY.errors.unavailable });
    if (stale) onStale();
  }

  return (
    <>
      <StaffButton ref={buttonRef} variant="secondary" onClick={() => openDialog(true)}>
        {COPY.action}
      </StaffButton>
      <StaffFormDialog
        open={open}
        onOpenChange={openDialog}
        title={COPY.title(lot)}
        description={COPY.description}
        submitLabel={COPY.submit}
        cancelLabel={COPY.cancel}
        tone="danger"
        size="md"
        pending={pending}
        initialFocusRef={reasonRef}
        onSubmit={() => void submit()}
      >
        {failure?.stale ? (
          <Notice tone="warning" alert title={COPY.stale.title}>
            {COPY.stale.description}
          </Notice>
        ) : failure ? (
          <Notice tone="danger" alert title={COPY.failedTitle}>
            {failure.message}
          </Notice>
        ) : null}
        <Field
          label={COPY.reasonLabel}
          description={COPY.reasonHint(DECLINE_REASON_MAX)}
          error={error ?? undefined}
          disabled={pending || failure?.stale === true}
        >
          <TextArea
            ref={reasonRef}
            rows={4}
            value={reason}
            maxLength={DECLINE_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </StaffFormDialog>
    </>
  );
}
