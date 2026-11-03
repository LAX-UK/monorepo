import {
  type AccountSecurityFactsResponse,
  accountDeletionDueAt,
  formatDeletionDay,
} from "@auction/identity-contracts";

export type DeletionBannerVm = { dueOn: string };

/** The banner's content, or null when no deletion is scheduled. */
export function buildDeletionBannerVm(
  facts: Pick<AccountSecurityFactsResponse, "deletionRequestedAt"> | null,
): DeletionBannerVm | null {
  if (!facts?.deletionRequestedAt) return null;
  return { dueOn: formatDeletionDay(accountDeletionDueAt(facts.deletionRequestedAt)) };
}
