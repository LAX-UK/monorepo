import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { PurchasesView } from "@/components/dashboard/purchases/purchases-view";
import { parsePurchaseTab } from "@/lib/purchases/purchase-progress";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases" };

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function DashboardPurchasesPage({ searchParams }: PageProps) {
  const [sources, { tab }] = await Promise.all([loadPurchaseSources(), searchParams]);
  return (
    <DashboardListPage title="Purchases" description="Lots you have won, from payment to delivery.">
      <PurchasesView vm={sources ? buildPurchasesVm(sources, parsePurchaseTab(tab)) : null} />
    </DashboardListPage>
  );
}
