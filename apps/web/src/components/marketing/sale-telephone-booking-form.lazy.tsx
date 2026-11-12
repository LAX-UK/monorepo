"use client";

import type { SaleTelephoneBookingFormProps } from "@/components/marketing/sale-telephone-booking-form";
import { useDeferredModule } from "@/hooks/use-deferred-module";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { Button } from "@auction/ui/lax/button";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { useRef } from "react";

const loadBookingForm = () =>
  import("@/components/marketing/sale-telephone-booking-form").then(
    (module) => module.SaleTelephoneBookingForm,
  );

/**
 * What the form's three fields, note and button occupy, so the card does not change height when
 * the form arrives. The note is real text: it does not depend on the form.
 */
function BookingFormPlaceholder({ contactNumber }: { contactNumber: string | null }) {
  const bar = "motion-reduce:animate-none";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className={`h-[18px] w-20 ${bar}`} />
        <Skeleton className={`h-9 w-full ${bar}`} />
      </div>
      <div className="space-y-2">
        <Skeleton className={`h-[18px] w-48 ${bar}`} />
        <Skeleton className={`h-9 w-full ${bar}`} />
      </div>
      <div className="space-y-2">
        <Skeleton className={`h-[18px] w-44 ${bar}`} />
        <Skeleton className={`h-[78px] w-full ${bar}`} />
      </div>
      <p className="font-body text-xs text-on-surface-variant">
        We will call {contactNumber} when your lot is approaching the block.
      </p>
      <Skeleton className={`h-9 w-40 ${bar}`} />
    </div>
  );
}

/**
 * The telephone request form, fetched when its card is within a screen of the viewport. Until it
 * arrives the card shows a placeholder of the form's own height; if the fetch fails or takes more
 * than ten seconds the card says so and offers a retry. The rest of the page is not affected.
 */
export function LazySaleTelephoneBookingForm(props: SaleTelephoneBookingFormProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const near = useNearViewport(anchor);
  const loaded = useDeferredModule(loadBookingForm, near);

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
        <BookingFormPlaceholder contactNumber={props.contactNumber} />
      )}
    </div>
  );
}
