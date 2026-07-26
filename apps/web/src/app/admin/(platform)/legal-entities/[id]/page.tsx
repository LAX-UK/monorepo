import { LegalEntityOverviewTab } from "@/components/admin/legal-entities/tabs/overview-tab";
import {
  legalEntityDetailTabHref,
  resolveLegalEntityRouteTab,
} from "@/lib/admin/catalog/detail-tab-compat";
import { loadAdminLegalEntityOverviewPage } from "@/lib/admin/legal-entities/load-legal-entity-overview-page";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; returnTo?: string; error?: string; success?: string }>;
};

export default async function AdminLegalEntityOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const routeTab = resolveLegalEntityRouteTab(sp.tab);
  if (routeTab !== "overview") {
    const target = legalEntityDetailTabHref(id, routeTab);
    const qs = new URLSearchParams();
    if (sp.returnTo) qs.set("returnTo", sp.returnTo);
    if (sp.error) qs.set("error", sp.error);
    if (sp.success) qs.set("success", sp.success);
    const suffix = qs.toString();
    redirect(suffix ? `${target}?${suffix}` : target);
  }

  const page = await loadAdminLegalEntityOverviewPage(id);
  const pendingDocCount = page.documents.filter((d) => d.reviewStatus === "pending").length;
  return (
    <LegalEntityOverviewTab
      entity={page.entity}
      creator={page.creator}
      health={page.health}
      pendingDocCount={pendingDocCount}
      activityEvents={page.activityEvents}
      canViewActivity={page.canViewActivity}
    />
  );
}
