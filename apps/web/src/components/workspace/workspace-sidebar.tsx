"use client";

import { AccountSwitcher } from "@/components/layout/account-switcher/account-switcher";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { ClientNavSection } from "@/lib/navigation/client-nav-model";
import { type WorkspaceNavCounts, WorkspaceNavList } from "./workspace-nav-list";

/**
 * The workspace sidebar, 240px on the near-white step: the account switcher (the one place in
 * the chrome that names the account), the role-shaped menu, and the account entries as a footer
 * group under a hairline. There is no collapse: clients visit occasionally and the menu is short.
 */
export function WorkspaceSidebar({
  account,
  sections,
  pathname,
  counts,
}: {
  account: AccountChrome;
  sections: readonly ClientNavSection[];
  pathname: string;
  counts: WorkspaceNavCounts;
}) {
  const footer = sections.filter((section) => section.id === "account");
  const main = sections.filter((section) => section.id !== "account");
  return (
    <div className="flex h-full min-h-0 flex-col">
      {account.switcher ? (
        <div className="shrink-0 px-3 pt-4 pb-2">
          <AccountSwitcher account={account} />
        </div>
      ) : null}
      <nav aria-label="Bid" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <WorkspaceNavList sections={main} pathname={pathname} counts={counts} />
      </nav>
      {footer.length > 0 ? (
        <nav aria-label="Your account" className="shrink-0 border-t border-lax-line px-3 py-3">
          <WorkspaceNavList sections={footer} pathname={pathname} counts={counts} />
        </nav>
      ) : null}
    </div>
  );
}
