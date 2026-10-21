import type { AccountOverviewVm } from "./account-overview.vm";

export type ProfileGap = "name" | "email-verification" | "phone";

/**
 * Details still missing from the account, in the order the Edit account screen
 * lists them. Only gaps the person can fix from here count: name and phone are
 * edited in LAX Bid, so they are ignored when Bid is not configured, while email
 * verification always has the hosted resend page.
 */
export function profileGaps(
  overview: Pick<AccountOverviewVm, "name" | "email" | "emailVerified" | "phone">,
  options: { profileEditable: boolean },
): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (options.profileEditable && !overview.name) gaps.push("name");
  if (overview.email && !overview.emailVerified) gaps.push("email-verification");
  if (options.profileEditable && !overview.phone) gaps.push("phone");
  return gaps;
}
