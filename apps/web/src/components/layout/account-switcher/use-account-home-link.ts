"use client";

import { accountHomeLink } from "@/lib/navigation/account-home";
import { useAccountChrome } from "./account-chrome-context";

/**
 * The way back to the first page of the account in use: "Back to Home" inside an organisation,
 * "Back to My bids" for a personal account (and outside the client shell).
 */
export function useAccountHomeLink(): { href: string; label: string } {
  const kind = useAccountChrome()?.current.kind ?? "personal";
  return accountHomeLink(kind);
}
