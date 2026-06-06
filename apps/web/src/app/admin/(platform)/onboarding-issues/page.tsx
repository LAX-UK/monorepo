import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { OnboardingIssuesBoard } from "@/components/admin/onboarding-issues-board";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import { getAdminOnboardingIssues } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Onboarding queues",
  "Legal entities, artists, KYC, and documents awaiting staff review.",
);

const ONBOARDING_TABS = new Set(["entities", "artists", "kyc", "orgs", "documents"]);

export default async function AdminOnboardingIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tabParam = sp.tab ?? "";
  const initialTab = ONBOARDING_TABS.has(tabParam) ? tabParam : "entities";

  let data: Awaited<ReturnType<typeof getAdminOnboardingIssues>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getAdminOnboardingIssues();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onboarding queues.";
  }

  const queueTotal = data
    ? data.entitiesPendingReview.length +
      data.artistsPendingApproval.length +
      data.staleKycSessions.length +
      data.staleLeadOrganisations.length +
      data.documentsAwaitingReview.length
    : 0;

  return (
    <PeopleListShell
      title="Onboarding & verification queues"
      description="Consolidated verification queues for entities, artists, KYC, and documents."
      wrapView={false}
      showCommandPaletteHint
      mobileSummary={
        data ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "total", label: "Open items", value: String(queueTotal) },
              {
                id: "entities",
                label: "Entities",
                value: String(data.entitiesPendingReview.length),
              },
              {
                id: "artists",
                label: "Artists",
                value: String(data.artistsPendingApproval.length),
              },
              { id: "kyc", label: "KYC", value: String(data.staleKycSessions.length) },
            ]}
          />
        ) : null
      }
      kpiStrip={
        data ? (
          <AdminListKpiStrip
            ariaLabel="Onboarding queue summary"
            tiles={[
              { label: "Open items", value: queueTotal },
              { label: "Entities", value: data.entitiesPendingReview.length },
              { label: "Artists", value: data.artistsPendingApproval.length },
              { label: "KYC sessions", value: data.staleKycSessions.length },
              { label: "Lead orgs", value: data.staleLeadOrganisations.length },
              { label: "Documents", value: data.documentsAwaitingReview.length },
            ]}
          />
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load queues">{loadError}</AdminListAlert>
        ) : undefined
      }
      view={data ? <OnboardingIssuesBoard data={data} defaultTab={initialTab} /> : null}
    />
  );
}
