import type { AccountOverviewVm } from "@/server/domain/account-overview.vm";
import { accountInitials } from "@/server/domain/account-settings.vm";

/** Who is signed in, as the header and the menus show them. */
export type AccountViewer = {
  displayName: string;
  name: string | null;
  email: string | null;
  initials: string | null;
};

export function toAccountViewer(
  overview: Pick<AccountOverviewVm, "displayName" | "name" | "email">,
): AccountViewer {
  return {
    displayName: overview.displayName,
    name: overview.name,
    email: overview.email,
    initials: accountInitials(overview),
  };
}
