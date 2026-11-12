"use client";

import type { SaleTelephoneBookingPanelFormProps } from "@/components/marketing/sale-telephone-booking-panel";
import { useAnchorIntent } from "@/hooks/use-anchor-intent";
import { useDeferredModule } from "@/hooks/use-deferred-module";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { Button } from "@auction/ui/lax/button";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { useRef } from "react";

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
 * arrives the card shows a placeholder of the form's own height; if the fetch fails or takes more
 * than ten seconds the card says so and offers a retry. The rest of the page is not affected.
 */
export function LazySaleTelephoneBookingPanelForm(props: SaleTelephoneBookingPanelFormProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const near = useNearViewport(anchor);
  const jumping = useAnchorIntent("telephone");
  const loaded = useDeferredModule(loadPanelForm, near || jumping);

  return (
    <div ref={anchor} aria-busy={loaded.status !== "ready" && loaded.status !== "failed"}>
      {loaded.status === "ready" ? (
        <loaded.value {...props} />
      ) : loaded.status === "failed" ? (
        <div className="space-y-3">
          <p className="font-body text-sm text-on-surface">
            The booking form did not load. Check your connection and try again.
          </p>
          <Button variant="secondary" type="button" onClick={loaded.retry}>
            Try again
          </Button>
        </div>
      ) : (
        <BookingPanelFormPlaceholder contactNumber={props.contactNumber} />
      )}
    </div>
  );
}
