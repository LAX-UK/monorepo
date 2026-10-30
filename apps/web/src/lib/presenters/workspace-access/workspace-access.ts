import { workspaceMenuEntryAt } from "@/lib/navigation/client-nav-model";
import { organisationTabAt } from "@/lib/navigation/organisation-tabs";
import { tabCapabilities } from "@/lib/navigation/section-tabs";
import { organisationRoleGroupsSentence } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityRoleCan,
} from "@auction/domain";
import { legalEntityMemberRoles } from "@auction/types";

/** A workspace page as the access page names it, with what a member needs to open it. */
export type WorkspacePage = {
  /** As it reads in "You don't have access to …": "Payouts", "this consignment". */
  label: string;
  /** Holding any of these opens it; empty means every member may. */
  anyCapability: readonly EntityCapability[];
  /** A record of one account, opened by its own address, rather than a page of the menu. */
  record: boolean;
};

/** Records with an address of their own; who may open one depends on whose it is. */
const RECORD_PAGES: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /^\/selling\/consignments\/[^/]+$/, label: "this consignment" },
  { pattern: /^\/purchases\/checkout\/[^/]+$/, label: "this purchase" },
  { pattern: /^\/bids\/telephone\/[^/]+$/, label: "this telephone bid" },
];

function pathOf(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * The workspace page at `href`, named the way the menu and the Organisation tabs name it, or
 * `null` for an address that is not a workspace page.
 */
export function workspacePageAt(href: string): WorkspacePage | null {
  const path = pathOf(href);
  const record = RECORD_PAGES.find((page) => page.pattern.test(path));
  if (record) return { label: record.label, anyCapability: [], record: true };
  const tab = organisationTabAt(path);
  if (tab) return { label: tab.label, anyCapability: tabCapabilities(tab), record: false };
  const entry = workspaceMenuEntryAt(path);
  return entry ? { label: entry.label, anyCapability: entry.anyCapability, record: false } : null;
}

/**
 * Who can open a page holding any of `anyCapability`, from the capability table: "Owners, admins
 * and finance". `null` when every member may, or nobody holds them.
 */
export function workspacePageOpenedBy(anyCapability: readonly EntityCapability[]): string | null {
  if (anyCapability.length === 0) return null;
  const roles = legalEntityMemberRoles.filter((role) =>
    anyCapability.some((capability) => entityRoleCan(role, capability)),
  );
  return roles.length > 0 ? organisationRoleGroupsSentence(roles) : null;
}

/** A page the member's role does not open: its name, and who can open it. */
export type WorkspacePageRefusal = { label: string; openedBy: string | null };

/**
 * Whether the role of a member acting as `actor` stops them opening the page at `href`: `null`
 * when it opens (always for a personal account, `actor` `null`), else the access page's words.
 * Pages ask this before loading anything, from the same table that builds the menu.
 */
export function workspacePageRefusal(
  href: string,
  actor: EntityActor | null,
): WorkspacePageRefusal | null {
  if (!actor) return null;
  const page = workspacePageAt(href);
  if (!page || page.record || page.anyCapability.length === 0) return null;
  if (page.anyCapability.some((capability) => entityActorCan(actor, capability))) return null;
  return { label: page.label, openedBy: workspacePageOpenedBy(page.anyCapability) };
}

/** What the access page says: the page's name, and who can open it when the role is why. */
export type WorkspaceAccessDenied = { page: string | null; openedBy: string | null };

/**
 * The access page's words for `href`, for a member acting as `actor` (`null` for a personal
 * account). It names who can open the page only when the member's role is what stops them; a
 * record, or a page of an account they do not use, is about the account and names nobody.
 */
export function workspaceAccessDenied(
  href: string,
  actor: EntityActor | null,
): WorkspaceAccessDenied {
  const refusal = workspacePageRefusal(href, actor);
  if (refusal) return { page: refusal.label, openedBy: refusal.openedBy };
  return { page: workspacePageAt(href)?.label ?? null, openedBy: null };
}
