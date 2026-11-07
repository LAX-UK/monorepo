import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { PayPage } from "@/components/pay/pay-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { getServerDataContainer } from "@/lib/data/container.server";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import { loadPayPlan } from "@/lib/pay/pay-api.server";
import { loadPayLotImages } from "@/lib/pay/pay-images.server";
import { belongsToAnotherAccount, payLandingRedirect } from "@/lib/pay/pay-landing";
import { payLinkProblemVm, payRefusalVm } from "@/lib/pay/pay-link-vm";
import { payHref } from "@/lib/pay/pay-links";
import { parsePayLots } from "@/lib/pay/pay-lots";
import { type PayPageVm, buildPayPageVm } from "@/lib/pay/pay-page.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pay" };

type PageProps = { searchParams: Promise<{ lots?: string | string[] }> };

function Shell({ vm, imageByLot }: { vm: PayPageVm; imageByLot: Record<string, string | null> }) {
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Pay" />
      <PayPage vm={vm} imageByLot={imageByLot} />
    </DashboardPage>
  );
}

/**
 * Pays for one invoice or several in one payment. The page shows the server's plan and nothing
 * it works out itself; paying sends back the lots and the total that were shown, and the server
 * refuses (409) if they are no longer what would be charged.
 */
export default async function PayRoute({ searchParams }: PageProps) {
  const lots = parsePayLots((await searchParams).lots);
  const returnTo = lots.kind === "lots" ? payHref(lots.ids) : payHref([]);
  await requireAuthenticatedUser({ shell: "client", loginNext: returnTo });

  if (lots.kind !== "lots") return <Shell vm={payLinkProblemVm(lots)} imageByLot={{}} />;

  const read = await loadPayPlan(lots.ids);
  if (read.kind === "unavailable") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Pay" />
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.pay} headingLevel="h1" />
      </DashboardPage>
    );
  }
  if (read.kind === "refused") return <Shell vm={payRefusalVm(read.reason)} imageByLot={{}} />;

  const { plan } = read;
  const landing = payLandingRedirect(lots.ids, plan);
  if (landing) redirect(landing);

  if (belongsToAnotherAccount(plan)) {
    // Won in another account of this person: open the payment there.
    const scope = await (await getServerDataContainer()).buying.scope();
    const [first] = lots.ids;
    const opened = first
      ? await openRecordInItsAccount({
          kind: "purchase",
          id: first,
          actingId: scope.account.id,
          next: returnTo,
        })
      : { kind: "render" as const };
    if (opened.kind === "hop") return <AccountRestoreHop href={opened.href} />;
  }

  const vm = buildPayPageVm(plan, new Date(), returnTo);
  const imageByLot = vm.lots.length > 0 ? await loadPayLotImages(vm.lots.map((l) => l.lotId)) : {};
  return <Shell vm={vm} imageByLot={imageByLot} />;
}
