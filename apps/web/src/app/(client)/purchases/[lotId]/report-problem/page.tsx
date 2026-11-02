import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PurchaseProblemForm } from "@/components/dashboard/purchases/purchase-problem-form";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerPurchaseProblem } from "@/lib/data/http/account-buying.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { purchaseCard } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "Report a problem" };

type PageProps = { params: Promise<{ lotId: string }> };

/**
 * Report a problem with one paid purchase, inside the workspace. A purchase that is not paid has
 * nothing to report, and one with a report already open goes back to the purchase, which shows it.
 */
export default async function ReportPurchaseProblemPage({ params }: PageProps) {
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
  const purchaseHref = card.detailHref;
  if (!card.problemHref) redirect(purchaseHref);
  const accountId = scope.account.id;
  const open = accountId
    ? await getServerPurchaseProblem(accountId, lotId).catch(() => null)
    : null;
  if (open) redirect(purchaseHref);

  return (
    <DashboardPage>
      <SetMobileShellTitle title="Report a problem" />
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-lax-display text-lax-28 font-semibold text-lax-fg" data-page-title="">
            Report a problem
          </h1>
          <p className="mt-1 text-lax-14 text-lax-muted">
            {card.title}
            {card.lotLabel ? ` · ${card.lotLabel}` : ""}
          </p>
        </div>
        <PurchaseProblemForm lotId={lotId} purchaseHref={purchaseHref} />
      </div>
    </DashboardPage>
  );
}
