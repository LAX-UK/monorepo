import { collectionBooking } from "@auction/db/schema";
import { and, inArray, isNull, or } from "drizzle-orm";
import type { BidAnonymisationScope } from "./bid-anonymisation-scope.js";

/** The bookings the person is behind: they made, authorised or collected at them, or own the account. */
export function involvedIn(
  scope: Pick<BidAnonymisationScope, "subjectIds" | "personalLegalEntityIds">,
) {
  const subjects = [...scope.subjectIds];
  const accounts = [...scope.personalLegalEntityIds];
  return and(
    isNull(collectionBooking.personalDetailsErasedAt),
    or(
      inArray(collectionBooking.bookedByUserId, subjects),
      inArray(collectionBooking.collectorUserId, subjects),
      inArray(collectionBooking.authorisedByUserId, subjects),
      accounts.length > 0 ? inArray(collectionBooking.legalEntityId, accounts) : undefined,
    ),
  );
}
