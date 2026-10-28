import { itemSubmission } from "@auction/db/schema";
import { type SQL, eq, isNotNull } from "drizzle-orm";
import type { SubmissionSenderFilter } from "../interfaces/index.js";

/** The submissions a viewer may see by who sent them; `all` adds nothing. */
export function submissionSenderSql(
  visibleTo: SubmissionSenderFilter | undefined,
): SQL | undefined {
  if (!visibleTo || visibleTo.scope === "all") return undefined;
  if (visibleTo.scope === "own") return eq(itemSubmission.submittedByUserId, visibleTo.userId);
  return isNotNull(itemSubmission.submittedByUserId);
}
