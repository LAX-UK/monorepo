import type { AccountOverviewVm } from "./account-overview.vm";

export type ProfileGap = "name" | "email-verification";

/**
 * Details still missing from the account, in the order the Personal details screen lists them.
 * Only gaps the person can fix from here count: the name is edited in Account and email
 * verification has the hosted resend page. A missing phone number is not listed because Account
 * cannot add one yet.
 */
export function profileGaps(
  overview: Pick<AccountOverviewVm, "name" | "email" | "emailVerified">,
): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!overview.name) gaps.push("name");
  if (overview.email && !overview.emailVerified) gaps.push("email-verification");
  return gaps;
}
