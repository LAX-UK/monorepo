import { initials } from "@/components/organisations/initials";
import { switchAccountHref } from "@/lib/navigation/account-link";
import { notificationHref } from "@/lib/notifications/notification-link";
import type { UserNotificationListItem } from "@auction/types";

/** An account the person uses, as the inbox needs it. */
export type InboxAccountOption = {
  id: string;
  kind: "personal" | "organisation";
  /** "Personal", or the organisation's name. */
  name: string;
  initials: string;
};

/** The accounts the page knows: every one the person uses, and the one in use. */
export type InboxAccounts = {
  options: readonly InboxAccountOption[];
  currentId: string;
};

/** The account tag on a row: "Northbank Gallery" or "Personal". */
export type InboxAccountTag = Pick<InboxAccountOption, "kind" | "name" | "initials">;

/** One inbox row as it reads and what it offers. */
export type InboxRowView = {
  id: string;
  title: string;
  message: string;
  unread: boolean;
  type: string;
  createdAt: Date;
  account: InboxAccountTag;
  /**
   * Where the row opens: in the account in use, or through the switch hop to the notification's
   * account (which says so, and offers the way back). `null` when there is nothing to open.
   */
  href: string | null;
  /** Opening it changes the account in use. */
  switchesAccount: boolean;
  /** "Don't notify me about …" for an organisation the person still belongs to. */
  mute: { legalEntityId: string; name: string; muted: boolean } | null;
};

/** The account a notification belongs to: its organisation, or the person's own. */
function accountOf(
  item: UserNotificationListItem,
  accounts: InboxAccounts,
): { id: string | null; tag: InboxAccountTag; member: boolean } {
  const personal = accounts.options.find((o) => o.kind === "personal");
  const personalTag: InboxAccountTag = {
    kind: "personal",
    name: "Personal",
    initials: personal?.initials ?? "P",
  };
  const account = item.account;
  if (!account || account.kind === "personal") {
    return { id: account?.legalEntityId ?? personal?.id ?? null, tag: personalTag, member: true };
  }
  return {
    id: account.legalEntityId,
    tag: {
      kind: "organisation",
      name: account.displayName,
      // The same initials as the switcher, so a row and the switcher read alike.
      initials:
        accounts.options.find((o) => o.id === account.legalEntityId)?.initials ??
        initials(account.displayName),
    },
    member: account.canSwitch,
  };
}

/**
 * The row for one notification. A notification for another account opens through the switch
 * hop: a member is switched with a notice and "Switch back"; someone who left the organisation is
 * told they no longer have access, never shown the page in the wrong account.
 */
export function inboxRowView(
  item: UserNotificationListItem,
  accounts: InboxAccounts,
  mutedIds: ReadonlySet<string>,
): InboxRowView {
  const { id: accountId, tag, member } = accountOf(item, accounts);
  const target = notificationHref(item);
  const switchesAccount = Boolean(target && accountId && accountId !== accounts.currentId);
  const href =
    target && accountId && switchesAccount
      ? switchAccountHref(accountId, target, { notificationFrom: accounts.currentId })
      : target;
  return {
    id: item.id,
    title: item.title,
    message: item.message,
    unread: !item.read,
    type: item.type,
    createdAt: item.createdAt,
    account: tag,
    href,
    switchesAccount: switchesAccount && member,
    mute:
      tag.kind === "organisation" && member && accountId
        ? { legalEntityId: accountId, name: tag.name, muted: mutedIds.has(accountId) }
        : null,
  };
}
