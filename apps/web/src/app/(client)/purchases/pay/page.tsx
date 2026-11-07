import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { PayPage } from "@/components/pay/pay-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { settlementsEmail } from "@/lib/checkout/settlements-contact";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { payAccountHop } from "@/lib/pay/pay-account-hop.server";
import { loadPayPlan } from "@/lib/pay/pay-api.server";
import { belongsToAnotherAccount, payLandingRedirect } from "@/lib/pay/pay-landing";
import { payLinkProblemVm, payRefusalVm } from "@/lib/pay/pay-link-vm";
import { parsePayReturned, payHref } from "@/lib/pay/pay-links";
import { loadPayLotDetails } from "@/lib/pay/pay-lot-details.server";
import { parsePayLots } from "@/lib/pay/pay-lots";
import { type PayPageVm, buildPayPageVm } from "@/lib/pay/pay-page.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pay" };

type PageProps = {
  searchParams: Promise<{ lots?: string | string[]; returned?: string | string[] }>;
};

function Shell({ vm }: { vm: PayPageVm }) {
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Pay" />
      <PayPage vm={vm} />
    </DashboardPage>
  );
}

/** Where "Contact settlements" goes: the settlements address when one is set, else Contact. */
function contactHref(): string {
  const email = settlementsEmail();
  return email ? `mailto:${email}` : "/contact";
}

/**
 * Pays for one invoice or several in one payment. The page shows the server's plan and nothing
 * it works out itself; paying sends back the lots and the total that were shown, and the server
 * refuses (409) if they are no longer what would be charged.
 */
export default async function PayRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const lots = parsePayLots(params.lots);
  const returned = parsePayReturned(params.returned);
  const returnTo = lots.kind === "lots" ? payHref(lots.ids) : payHref([]);
  await requireAuthenticatedUser({ shell: "client", loginNext: returnTo });

  if (lots.kind !== "lots") return <Shell vm={payLinkProblemVm(lots)} />;

  const read = await loadPayPlan(lots.ids);
  if (read.kind === "unavailable") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Pay" />
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.pay} headingLevel="h1" />
      </DashboardPage>
    );
  }
  if (read.kind === "refused") {
    // A person whose role here does not cover payments may have the link for a lot won in their
    // own account: open it there before telling them they cannot.
    if (read.reason === "no_role") {
      const hop = await payAccountHop(lots.ids[0], returnTo);
      if (hop) return <AccountRestoreHop href={hop} />;
    }
    return <Shell vm={payRefusalVm(read.reason)} />;
  }

  const { plan } = read;
  const landing = payLandingRedirect(lots.ids, plan);
  if (landing) redirect(landing);

  if (belongsToAnotherAccount(plan)) {
    const hop = await payAccountHop(lots.ids[0], returnTo);
    if (hop) return <AccountRestoreHop href={hop} />;
  }

  const details = plan.payable.length > 0 ? await loadPayLotDetails(lots.ids) : {};
  const vm = buildPayPageVm(plan, new Date(), {
    returnTo,
    contactHref: contactHref(),
    returned,
    details,
  });
  return <Shell vm={vm} />;
}
