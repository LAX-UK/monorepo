import { notification } from "@auction/db/schema";
import { and, inArray, ne } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { BidAnonymisationScope } from "./bid-anonymisation-scope.js";

/** The notice types whose message once carried the identity provider's free-text reason. */
const IDENTITY_CHECK_NOTICE_TYPES = ["kyc_resubmission_required"];

/**
 * In-app notices are kept as the record, but an identity-check notice loses its message: older
 * ones quote the provider's reason, which can repeat what the person submitted. The column is
 * required, so an empty string stands for "no message".
 */
export async function scrubIdentityCheckNotices(
  tx: ProjectorDbConnection,
  scope: Pick<BidAnonymisationScope, "subjectIds">,
): Promise<number> {
  const rows = await tx
    .update(notification)
    .set({ message: "" })
    .where(
      and(
        inArray(notification.userId, [...scope.subjectIds]),
        inArray(notification.type, IDENTITY_CHECK_NOTICE_TYPES),
        ne(notification.message, ""),
      ),
    )
    .returning({ id: notification.id });
  return rows.length;
}
