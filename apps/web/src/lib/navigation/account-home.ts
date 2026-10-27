import { type EntityCapability, entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import { CLIENT_ROUTES } from "./client-routes";

/** Whose account the signed-in person is using. */
export type AccountContext =
  | { kind: "personal" }
  | { kind: "organisation"; id: string; role: LegalEntityMemberRole };

/**
 * Where an organisation member's Home leads, first match wins, until organisations get a Home
 * page of their own: the selling overview for those who follow consignments, otherwise My bids.
 */
const ORGANISATION_LANDINGS: readonly { capability: EntityCapability; path: string }[] = [
  { capability: "entity.consignments.read", path: CLIENT_ROUTES.selling },
  { capability: "entity.bid.place", path: CLIENT_ROUTES.bids },
];

/** The first page of an account. A personal account has no Home and starts at My bids. */
export function accountHomePath(context: AccountContext): string {
  if (context.kind === "personal") return CLIENT_ROUTES.bids;
  const landing = ORGANISATION_LANDINGS.find(({ capability }) =>
    entityRoleCan(context.role, capability),
  );
  return landing?.path ?? CLIENT_ROUTES.watching;
}
