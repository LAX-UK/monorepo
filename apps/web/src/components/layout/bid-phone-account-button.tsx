"use client";

import { PhoneAccountButton } from "@/components/workspace/phone-account-button";
import { usesBidAsClient } from "@/lib/auth/client-audience";
import { useAppSession } from "@/lib/auth/use-app-session";
import { buildAccountSwitcher } from "@/lib/navigation/account-switcher-model";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";

/**
 * The account button in the phone header, for someone with an organisation: it shows the account
 * in use and opens the "Switch account" sheet. People with only their own account have nothing
 * to switch to, and from 768px the header's account menu does this job.
 */
export function BidPhoneAccountButton() {
  const { user } = useAppSession();
  const isClient = user !== null && usesBidAsClient(user);
  const context = useAccountMenuContext(user?.id ?? "", isClient);
  const current = context?.accounts?.find((account) => account.current);
  if (!user || !context?.accounts || !current) return null;
  return (
    <div className="md:hidden">
      <PhoneAccountButton
        user={user}
        current={current}
        switcher={buildAccountSwitcher(context.accounts, context.pendingInvitations)}
      />
    </div>
  );
}
