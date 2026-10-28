import type { AccountContext } from "./account-home";

/**
 * How the signed-in client pages are framed.
 * - `website`: inside the public lax.bid site (public header, account sub-navigation, footer).
 * - `workspace`: the organisation workspace (sidebar, workspace header, Home dashboard).
 */
export type ClientLayout = "website" | "workspace";

/**
 * A person's own account is a set of pages on the public site; an organisation is a business
 * with its own workspace. Adding a new kind of account is one row here.
 */
const LAYOUT_BY_ACCOUNT: Record<AccountContext["kind"], ClientLayout> = {
  personal: "website",
  organisation: "workspace",
};

/** The frame for the account in use. Pages never choose this themselves. */
export function chooseClientLayout(account: AccountContext): ClientLayout {
  return LAYOUT_BY_ACCOUNT[account.kind];
}
