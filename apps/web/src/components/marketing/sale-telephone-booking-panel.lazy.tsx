"use client";

import type { SaleTelephoneBookingPanelFormProps } from "@/components/marketing/sale-telephone-booking-panel";
import { useAnchorIntent } from "@/hooks/use-anchor-intent";
import { useDeferredModule } from "@/hooks/use-deferred-module";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { Button } from "@auction/ui/lax/button";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { useEffect, useId, useRef } from "react";

const loadPanelForm = () =>
  import("@/components/marketing/sale-telephone-booking-panel").then(
    (module) => module.SaleTelephoneBookingPanelForm,
  );

/**
 * What the form's three fields, note and button occupy, so the card does not change height when
 * the form arrives. The note is real text: it does not depend on the form.
 */
function BookingPanelFormPlaceholder({ contactNumber }: { contactNumber: string | null }) {
  const bar = "motion-reduce:animate-none";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className={`h-4 w-20 ${bar}`} />
        <Skeleton className={`h-9 w-full ${bar}`} />
      </div>
      <div className="space-y-2">
        <Skeleton className={`h-4 w-48 ${bar}`} />
        <Skeleton className={`h-9 w-full ${bar}`} />
      </div>
      <div className="space-y-2">
        <Skeleton className={`h-4 w-44 ${bar}`} />
        <Skeleton className={`h-[78px] w-full ${bar}`} />
      </div>
      <p className="font-body text-xs text-on-surface-variant">
        We will call {contactNumber} when your lot is approaching the block.
      </p>
      <Skeleton className={`lax-target h-9 w-40 ${bar}`} />
    </div>
  );
}

/**
 * The telephone request form, fetched when its card is within a screen of the viewport, or as soon
 * as a link to its section is pointed at (the section tab), so a jump does not wait. Until it
 * arrives the card shows a placeholder of the form's own height. If the fetch fails or takes more
 * than ten seconds, the message and a retry are laid over that same box (the placeholder stays,
 * hidden, underneath), so the card never changes height. The rest of the page is not affected.
 *
 * Focus: pressing Try again moves focus to this region, which stays mounted, so it is not lost to
 * the page; if the retry fails again, focus returns to Try again.
 */
export function LazySaleTelephoneBookingPanelForm(props: SaleTelephoneBookingPanelFormProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const retried = useRef(false);
  const messageId = useId();
  const near = useNearViewport(anchor);
  const jumping = useAnchorIntent("telephone");
  const loaded = useDeferredModule(loadPanelForm, near || jumping);
  const failed = loaded.status === "failed";

  useEffect(() => {
    if (failed && retried.current) retryButton.current?.focus();
  }, [failed]);

  const retry = () => {
    retried.current = true;
    anchor.current?.focus();
    loaded.retry();
  };

  return (
    <div
      ref={anchor}
      // biome-ignore lint/a11y/useSemanticElements: a fieldset would wrap the form's own fields and change their box (min-content sizing); this is only a labelled focus target
      role="group"
      aria-label="Telephone line request"
      tabIndex={-1}
      className="outline-none"
      aria-busy={loaded.status !== "ready" && !failed}
    >
      {loaded.status === "ready" ? (
        <loaded.value {...props} />
      ) : (
        <div className="grid" data-testid="telephone-form-box">
          <div
            className={failed ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}
            aria-hidden={failed || undefined}
          >
            <BookingPanelFormPlaceholder contactNumber={props.contactNumber} />
          </div>
          {failed ? (
            <div role="alert" className="col-start-1 row-start-1 space-y-3 self-start">
              <p id={messageId} className="font-body text-sm text-on-surface">
                The booking form did not load. Check your connection and try again.
              </p>
              <Button
                ref={retryButton}
                variant="secondary"
                type="button"
                aria-describedby={messageId}
                onClick={retry}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
