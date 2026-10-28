import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { accountHomePathForKind } from "./account-home";
import { switchAccountHref } from "./account-link";
import type { AccountMenuEntry } from "./account-menu-model";
import { type AccountOption, pendingInvitationsLabel } from "./account-switcher-model";
import { type AttentionCount, type ClientAttention, attentionCountFor } from "./client-attention";
import {
  type ClientNavScope,
  type ClientNavSectionId,
  getClientNavSections,
  navItemMatches,
} from "./client-nav-model";
import { CLIENT_ROUTES } from "./client-routes";

/** One account under "Your accounts": the one in use, or one to open. */
export type HeaderMenuAccount = {
  id: string;
  kind: AccountOption["kind"];
  name: string;
  /** "Bids, purchases and selling", or "Organisation workspace · Buyer". */
  detail: string;
  initials: string;
  /** `null` for the account in use ("Here"); otherwise the hop that opens it. */
  openHref: string | null;
};

/** One page in the menu, with whatever is due there. */
export type HeaderMenuLink = {
  id: string;
  label: string;
  href: string;
  icon: AppShellNavItem["icon"];
  external: boolean;
  current: boolean;
  count: AttentionCount | null;
};

export type HeaderMenuSection = {
  id: ClientNavSectionId;
  label: string | null;
  links: HeaderMenuLink[];
};

/** The header account menu for a client: their accounts, then their pages by section. */
export type HeaderAccountMenu = {
  /** Shown only to organisation members, who have more than one account. */
  accounts: HeaderMenuAccount[] | null;
  /** Invitations to answer, when there are any. */
  invitations: AccountMenuEntry | null;
  sections: HeaderMenuSection[];
};

export type HeaderAccountMenuInput = {
  scope: ClientNavScope;
  /** Every account the person can use; `null` when they have only their own. */
  accounts: readonly AccountOption[] | null;
  pendingInvitations: number;
  attention: ClientAttention;
  pathname: string;
};

const PERSONAL_DETAIL = "Bids, purchases and selling";

function menuAccount(option: AccountOption): HeaderMenuAccount {
  const destination = accountHomePathForKind(option.kind);
  return {
    id: option.id,
    kind: option.kind,
    name: option.name,
    detail:
      option.kind === "personal" ? PERSONAL_DETAIL : `Organisation workspace · ${option.detail}`,
    initials: option.initials,
    openHref: option.current ? null : switchAccountHref(option.id, destination),
  };
}

function menuLink(
  item: AppShellNavItem,
  attention: ClientAttention,
  pathname: string,
): HeaderMenuLink {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    icon: item.icon,
    external: item.external === true,
    current: !item.external && navItemMatches(item, pathname),
    count: attentionCountFor(item.id, attention),
  };
}

/**
 * The client's header account menu, built from the same navigation model as the account
 * sub-navigation and the workspace sidebar, so a page is added in one place.
 */
export function buildHeaderAccountMenu(input: HeaderAccountMenuInput): HeaderAccountMenu {
  const { scope, attention, pathname } = input;
  const hasOrganisations = input.accounts?.some((option) => option.kind === "organisation");
  return {
    accounts: hasOrganisations && input.accounts ? input.accounts.map(menuAccount) : null,
    invitations:
      input.pendingInvitations > 0
        ? {
            id: "pending-invitations",
            label: pendingInvitationsLabel(input.pendingInvitations),
            href: CLIENT_ROUTES.invitations,
          }
        : null,
    sections: getClientNavSections(scope).map((section) => ({
      id: section.id,
      label: section.label,
      links: section.items.map((item) => menuLink(item, attention, pathname)),
    })),
  };
}
