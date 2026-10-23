import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { loadAccountSession } from "@/server/application/load-account-session";
import { buildDeletionPageVm } from "@/server/domain/account-deletion.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Delete your account · LAX Account" };

/**
 * Delete your account. Every visit asks Identity, which asks each product what the person still
 * has in flight, so the page always shows the current answer rather than a stale one.
 */
export default async function DeleteAccountPage() {
  const session = await loadAccountSession({ withLiveDeletion: true });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.deleteAccount} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.deleteAccount}`);

  return (
    <AccountShell>
      <AccountPageHeader
        title="Delete your account"
        backHref={ACCOUNT_ROUTES.security}
        backLabel="Back to password and security"
      />
      <DeleteAccountSection
        vm={buildDeletionPageVm(session.liveDeletion)}
        pagePath={ACCOUNT_ROUTES.deleteAccount}
      />
    </AccountShell>
  );
}
