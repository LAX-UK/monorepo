import type { LegalEntityMemberRole } from "@auction/types";

/**
 * What a role can do instead, said after who can open a page: a consignor follows their works in
 * Consignments, a buyer agent asks about their limits. A role with nothing to add says nothing.
 * Keyed by role, so the line is the same wherever that role meets a closed page.
 */
const ROLE_HINT: Partial<Record<LegalEntityMemberRole, string>> = {
  consignor: "As a consignor, you can follow your own works in Consignments.",
  buyer_agent: "Ask an owner or admin if you need a change to your limits.",
  finance: "As finance, you can pay invoices in Purchases.",
  viewer: "As a viewer, you can see what the organisation owns in Works.",
};

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * The access page's line for a page the member's role doesn't open: "Sold & payouts for
 * Northbank Gallery is open to owners, admins and finance. As a consignor, you can follow your own
 * works in Consignments." `null` when nobody is named (the shared line then applies).
 */
export function workspaceAccessReason(input: {
  page: string;
  organisationName: string;
  openedBy: string | null;
  role: LegalEntityMemberRole;
}): string | null {
  if (!input.openedBy) return null;
  const opened = `${input.page} for ${input.organisationName} is open to ${lowerFirst(input.openedBy)}.`;
  const hint = ROLE_HINT[input.role];
  return hint ? `${opened} ${hint}` : opened;
}

/** "Need access? Ask an owner: Maya Okafor", or `null` with no owner to name. */
export function askAnOwnerLine(ownerNames: readonly string[]): string | null {
  const [first] = ownerNames;
  return first ? `Need access? Ask an owner: ${first}` : null;
}
