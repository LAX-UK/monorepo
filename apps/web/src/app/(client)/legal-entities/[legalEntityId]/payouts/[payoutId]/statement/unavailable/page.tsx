import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { payoutStatementHref } from "@/lib/seller/payout-statement-links";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Statement unavailable" };

type PageProps = { params: Promise<{ legalEntityId: string; payoutId: string }> };

/**
 * Where a statement download that failed lands. The payout itself is untouched; "Try again"
 * asks for the statement once more.
 */
export default async function StatementUnavailablePage({ params }: PageProps) {
  const { legalEntityId, payoutId } = await params;
  const retryHref = payoutStatementHref(legalEntityId, payoutId);
  await requireAuthenticatedUser({ shell: "client", loginNext: retryHref });
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Statement" />
      <AccountLoadError
        title="We couldn't prepare this statement"
        description="This is on our side. Your payout is not affected, and the statement will be here when it is ready."
        retryHref={retryHref}
      />
    </DashboardPage>
  );
}
