import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PurchaseDetail } from "@/components/dashboard/purchases/purchase-detail";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { SITE_CONTACT_EMAIL } from "@/lib/brand";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerCollectionOffer } from "@/lib/data/http/account-buying.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { deliveryPanel } from "@/lib/purchases/purchase-delivery.vm";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { purchaseCard } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Purchase" };

/** Delivery stages that show where and how to collect. */
const COLLECTION_STAGES = new Set(["awaiting_payment", "choose", "preparing", "ready_to_collect"]);

type PageProps = { params: Promise<{ lotId: string }> };

/**
 * One purchase: where it stands, what was paid, how it is delivered and its documents. It reads
 * the same sources as the list, so the two never disagree, and only the account's members who
 * follow its purchases open it.
 */
export default async function PurchaseDetailPage({ params }: PageProps) {
  const { lotId } = await params;
  const scope = await (await getServerDataContainer()).buying.scope();
  const view = buyingPageView(scope, "purchases");
  if (view.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title={view.label} />
        <WorkspacePageNoAccess
          label={view.label}
          openedBy={view.openedBy}
          next={CLIENT_ROUTES.purchases}
        />
      </>
    );
  }
  const sources = await loadPurchaseSources();
  const row = sources?.rows.find((candidate) => candidate.lot.id === lotId);
  if (!sources || !row) notFound();
  const card = purchaseCard(row, sources);
  const facts = sources.factsByLot?.[lotId] ?? null;
  const organisation = scope.account.kind === "organisation" ? scope.account : null;
  const collection =
    facts && COLLECTION_STAGES.has(facts.delivery.stage)
      ? await getServerCollectionOffer(organisation?.id ?? null, lotId).catch(() => null)
      : null;
  const panel = facts
    ? deliveryPanel({
        facts,
        collection,
        payerTeam: organisation ? `${organisation.name}'s finance team` : "The account's payer",
      })
    : null;
  const wonOn = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(row.lot.endTime);
  return (
    <DashboardPage>
      <SetMobileShellTitle title={card.title} />
      <PurchaseDetail
        card={card}
        subtitle={[card.lotLabel, card.saleTitle, wonOn, card.wonBy ? `won by ${card.wonBy}` : null]
          .filter(Boolean)
          .join(" · ")}
        panel={panel}
        shipperEmail={collection?.kind === "email" ? collection.email : SITE_CONTACT_EMAIL}
      />
    </DashboardPage>
  );
}
