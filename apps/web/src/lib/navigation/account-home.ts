import type { LegalEntityMemberRole } from "@auction/types";
import { CLIENT_ROUTES } from "./client-routes";

/** Whose account the signed-in person is using. */
export type AccountContext =
  | { kind: "personal" }
  | { kind: "organisation"; id: string; role: LegalEntityMemberRole };

/**
 * The first page of an account. Every organisation member starts on its Home, shaped by their
 * role; a personal account has no Home and starts at My bids.
 */
export function accountHomePath(context: AccountContext): string {
  return context.kind === "personal" ? CLIENT_ROUTES.bids : CLIENT_ROUTES.home;
}
