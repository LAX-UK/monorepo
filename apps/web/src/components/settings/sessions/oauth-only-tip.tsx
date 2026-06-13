"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import Link from "next/link";

export function OauthOnlyTip() {
  const { state, loading } = useConnectedAccounts();
  if (loading || state.hasPassword) return null;
  return (
    <p className="rounded-lg border border-border-hairline bg-surface-container-high/30 px-3 py-2 font-body text-xs text-on-surface-variant">
      <span className="font-medium text-on-surface">Tip:</span> Add a password under{" "}
      <Link
        href="/dashboard/settings?tab=security#password-setup"
        className="text-link underline-offset-2 hover:underline"
      >
        Connected accounts
      </Link>{" "}
      to enable extra security checks on sensitive actions.
    </p>
  );
}
