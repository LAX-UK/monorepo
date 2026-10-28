"use client";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { AccountMenuEntry, AccountMenuFacts } from "@/lib/navigation/account-menu-model";
import { buildAccountMenu } from "@/lib/navigation/account-menu-model";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";
import { cn } from "@auction/ui";
import Link from "next/link";
import { Fragment, useMemo } from "react";

export type AccountMenuVariant = "header" | "shell" | "drawer";

const ITEM_CLASS: Record<AccountMenuVariant, string> = {
  header:
    "block px-3 py-2.5 font-label text-sm font-medium text-brand-900 transition-colors hover:bg-page-bg focus-visible:bg-page-bg focus-visible:outline-none dark:text-on-surface dark:hover:bg-surface-container-low",
  shell:
    "block px-4 py-2.5 font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none",
  drawer: cn(
    "block min-h-11 rounded-sm py-2 font-label text-sm font-medium",
    "text-brand-900 transition-colors hover:text-brand-800 dark:text-on-surface",
    FOCUS_RING,
  ),
};

const SEPARATOR_CLASS: Record<AccountMenuVariant, string> = {
  header: "my-1 border-0 border-t border-nav-border dark:border-border-hairline",
  shell: "my-1 border-0 border-t border-shell-stroke",
  drawer: "my-1 border-0 border-t border-nav-border dark:border-border-hairline",
};

/** Groups for the signed-in menu; safe defaults apply until the person's facts arrive. */
export function useAccountMenuGroups(user: SessionUser, enabled: boolean): AccountMenuEntry[][] {
  // Staff have no client facts to load: their menu is the admin area and LAX Account.
  const context = useAccountMenuContext(user.id, enabled && usesBidAsClient(user));
  return useMemo(() => {
    const facts: AccountMenuFacts = {
      hasConsigned: context?.hasConsigned ?? false,
      isOrgMember: context?.isOrgMember ?? false,
      pendingInvitations: context?.pendingInvitations ?? 0,
      user,
    };
    return buildAccountMenu(facts);
  }, [context, user]);
}

type AccountMenuItemsProps = {
  groups: AccountMenuEntry[][];
  variant: AccountMenuVariant;
  /** Menu popovers expose menuitem semantics and keyboard roving; the drawer is a plain list. */
  menu: boolean;
  onNavigate: () => void;
};

/** The shared body of every signed-in account menu: grouped links divided by separators. */
export function AccountMenuItems({ groups, variant, menu, onNavigate }: AccountMenuItemsProps) {
  const itemProps = menu ? { role: "menuitem", "data-account-menu-item": "" } : {};
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group[0]?.id ?? index}>
          {index > 0 ? <hr className={SEPARATOR_CLASS[variant]} /> : null}
          {group.map((entry) =>
            entry.external ? (
              <a
                key={entry.id}
                href={entry.href}
                rel="noopener noreferrer"
                className={ITEM_CLASS[variant]}
                onClick={onNavigate}
                {...itemProps}
              >
                {entry.label}
              </a>
            ) : (
              <Link
                key={entry.id}
                href={entry.href}
                className={ITEM_CLASS[variant]}
                onClick={onNavigate}
                {...itemProps}
              >
                {entry.label}
              </Link>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
