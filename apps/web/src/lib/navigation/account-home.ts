import type { LegalEntityMemberRole } from "@auction/types";
import { CLIENT_ROUTES } from "./client-routes";

/** Whose account the signed-in person is using. */
export type AccountContext =
  | { kind: "personal" }
  | { kind: "organisation"; id: string; role: LegalEntityMemberRole };

/**
 * The first page of each kind of account. Every organisation member starts on its Home, shaped
 * by their role; a personal account has no Home and starts at My bids.
 */
const HOME_BY_KIND: Record<AccountContext["kind"], string> = {
  personal: CLIENT_ROUTES.bids,
  organisation: CLIENT_ROUTES.home,
};

/** The first page of a kind of account. */
export function accountHomePathForKind(kind: AccountContext["kind"]): string {
  return HOME_BY_KIND[kind];
}

/** The first page of an account. */
export function accountHomePath(context: AccountContext): string {
  return accountHomePathForKind(context.kind);
}
