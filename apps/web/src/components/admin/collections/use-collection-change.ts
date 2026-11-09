"use client";

import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import type { ActionResult } from "@/lib/forms/form-result";
import type { StaffAffectedBooking, StaffCollectionChangeResult } from "@auction/types";
import type { AffectedBookingsChoice, AffectedBookingsChoiceValue } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type ChangeResult = ActionResult<StaffCollectionChangeResult>;

/** A change that did not go through, as the page shows it. */
export type ChangeFailure = {
  message: string;
  code: string | undefined;
  /** For a refused save: the fields at fault, by the name the API gave them. */
  issues: unknown;
};

/**
 * One change to the collection settings (a save, a closure added or removed) that may leave
 * booked visits outside what the place offers. The first attempt is sent without a choice. If
 * the API answers with the bookings it would touch, they are held here for the person to see and
 * decide on; the change is then sent again with their choice. Nothing is ever cancelled unless
 * the person chose it. A stale sign-in sends the person to sign in again.
 */
export function useCollectionChange(
  send: (choice: AffectedBookingsChoice | undefined) => Promise<ChangeResult>,
  onDone: (result: StaffCollectionChangeResult) => void,
) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [affected, setAffected] = useState<StaffAffectedBooking[] | null>(null);
  const [failure, setFailure] = useState<ChangeFailure | null>(null);

  const attempt = useCallback(
    async (choice: AffectedBookingsChoice | undefined) => {
      setBusy(true);
      setFailure(null);
      try {
        const result = await send(choice);
        if (result.ok && result.data) {
          setAffected(null);
          onDone(result.data);
          router.refresh();
          return;
        }
        if (result.ok) return;
        if (handleStaffStepUp(result)) return;
        if (result.errorCode === "bookings_affected") {
          const list = result.meta?.affected;
          setAffected(Array.isArray(list) ? (list as StaffAffectedBooking[]) : []);
          return;
        }
        setAffected(null);
        setFailure({ message: result.error, code: result.errorCode, issues: result.meta?.issues });
      } finally {
        setBusy(false);
      }
    },
    [send, onDone, router],
  );

  return {
    busy,
    affected,
    failure,
    submit: () => attempt(undefined),
    // The choice is bound to the visits on the list the person is looking at.
    confirm: (choice: AffectedBookingsChoiceValue) =>
      attempt({ choice, bookingIds: (affected ?? []).map((booking) => booking.bookingId) }),
    dismissAffected: () => setAffected(null),
    clearFailure: () => setFailure(null),
    reload: () => router.refresh(),
  };
}
