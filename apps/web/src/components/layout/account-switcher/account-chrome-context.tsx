"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { type ReactNode, createContext, useContext } from "react";

const AccountChromeContext = createContext<AccountChrome | null>(null);

/** Makes the account in use and its switcher available to pages inside the client shell. */
export function AccountChromeProvider({
  account,
  children,
}: {
  account: AccountChrome | null;
  children: ReactNode;
}) {
  return <AccountChromeContext.Provider value={account}>{children}</AccountChromeContext.Provider>;
}

/** The account chrome, or `null` outside the client shell. */
export function useAccountChrome(): AccountChrome | null {
  return useContext(AccountChromeContext);
}
