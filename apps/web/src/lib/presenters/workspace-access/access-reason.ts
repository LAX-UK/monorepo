import { workspaceMenuEntryAt } from "@/lib/navigation/client-nav-model";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * What a role can do instead, said after who can open a page: a consignor follows their works,
 * finance pays invoices. Each hint names its page from the workspace menu, so a rename there
 * changes the words here. A role with nothing to add says nothing.
 */
const ROLE_HINT: Partial<
  Record<LegalEntityMemberRole, { route: string; line: (page: string) => string }>
> = {
  consignor: {
    route: CLIENT_ROUTES.consignments,
    line: (page) => `As a consignor, you can follow your own works in ${page}.`,
  },
  finance: {
    route: CLIENT_ROUTES.purchases,
    line: (page) => `As finance, you can pay invoices in ${page}.`,
  },
  viewer: {
    route: CLIENT_ROUTES.collection,
    line: (page) => `As a viewer, you can see what the organisation owns in ${page}.`,
  },
};

/** The role's hint, or `null` when the role has none or its page is not in the menu. */
function roleHint(role: LegalEntityMemberRole): string | null {
  const hint = ROLE_HINT[role];
  const page = hint ? workspaceMenuEntryAt(hint.route)?.label : undefined;
  return hint && page ? hint.line(page) : null;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * The access page's line for a page the member's role doesn't open, written for the page rather
 * than the role: "Sold & payouts is for owners, admins and finance. As a consignor, you can follow
 * your own works in Consignments." `null` when nobody is named (the shared line then applies).
 */
export function workspaceAccessReason(input: {
  page: string;
  openedBy: string | null;
  role: LegalEntityMemberRole;
}): string | null {
  if (!input.openedBy) return null;
  const opened = `${input.page} is for ${lowerFirst(input.openedBy)}.`;
  const hint = roleHint(input.role);
  return hint ? `${opened} ${hint}` : opened;
}

/** "Need access? Ask an owner: Maya Okafor", or `null` with no owner to name. */
export function askAnOwnerLine(ownerNames: readonly string[]): string | null {
  const [first] = ownerNames;
  return first ? `Need access? Ask an owner: ${first}` : null;
}
