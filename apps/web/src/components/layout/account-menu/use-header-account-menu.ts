"use client";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { type AccountMenuEntry, buildAccountMenu } from "@/lib/navigation/account-menu-model";
import { type AttentionChip, NO_ATTENTION, attentionChip } from "@/lib/navigation/client-attention";
import { PERSONAL_NAV_SCOPE } from "@/lib/navigation/client-nav-model";
import {
  type HeaderAccountMenu,
  buildHeaderAccountMenu,
} from "@/lib/navigation/header-account-menu.vm";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

/** The signed-in header menu: a client's pages and accounts, or a staff member's admin links. */
export type HeaderAccountMenuState =
  | { kind: "client"; menu: HeaderAccountMenu; chip: AttentionChip | null }
  | { kind: "staff"; groups: AccountMenuEntry[][] };

/**
 * The header account menu for the signed-in person. Clients get their pages from the client nav
 * model, with safe defaults (a personal buyer) until their facts load; staff keep the admin
 * area and LAX Account only, and never load client facts.
 */
export function useHeaderAccountMenu(user: SessionUser): HeaderAccountMenuState {
  const isClient = usesBidAsClient(user);
  const context = useAccountMenuContext(user.id, isClient);
  const pathname = usePathname() ?? "";

  return useMemo<HeaderAccountMenuState>(() => {
    if (!isClient) {
      return {
        kind: "staff",
        groups: buildAccountMenu({
          hasConsigned: false,
          isOrgMember: false,
          pendingInvitations: 0,
          user,
        }),
      };
    }
    const attention = context?.attention ?? NO_ATTENTION;
    return {
      kind: "client",
      menu: buildHeaderAccountMenu({
        scope: context?.scope ?? PERSONAL_NAV_SCOPE,
        accounts: context?.accounts ?? null,
        pendingInvitations: context?.pendingInvitations ?? 0,
        attention,
        pathname,
      }),
      chip: attentionChip(attention),
    };
  }, [isClient, context, pathname, user]);
}
