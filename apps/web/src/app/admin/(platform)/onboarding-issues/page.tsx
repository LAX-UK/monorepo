import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { OnboardingIssuesBoard } from "@/components/admin/onboarding-issues-board";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import { onboardingIssuesListController } from "@/lib/admin/onboarding-issues-list-controller";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Onboarding queues",
  "Legal entities, artists, KYC, and documents awaiting staff review.",
);

export default async function AdminOnboardingIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const query = onboardingIssuesListController.parseQuery(sp);

  let result: Awaited<ReturnType<typeof onboardingIssuesListController.fetch>> | null = null;
  let loadError: string | null = null;
  try {
    result = await onboardingIssuesListController.fetch(query);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onboarding queues.";
  }

  const data = result?.data ?? null;
  const summary = result?.summary;
  const queueTotal = summary?.queueTotal ?? 0;

  return (
    <PeopleListShell
      title="Onboarding & verification queues"
      description="Consolidated verification queues for entities, artists, KYC, and documents."
      wrapView={false}
      mobileSummary={
        summary ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "total", label: "Open items", value: String(summary.queueTotal) },
              { id: "entities", label: "Entities", value: String(summary.entities) },
              { id: "artists", label: "Artists", value: String(summary.artists) },
              { id: "kyc", label: "KYC", value: String(summary.kyc) },
            ]}
          />
        ) : null
      }
      kpiStrip={
        summary ? (
          <AdminListKpiStrip
            ariaLabel="Onboarding queue summary"
            tiles={[
              { label: "Open items", value: summary.queueTotal },
              { label: "Entities", value: summary.entities },
              { label: "Artists", value: summary.artists },
              { label: "KYC sessions", value: summary.kyc },
              { label: "Lead orgs", value: summary.orgs },
              { label: "Documents", value: summary.documents },
            ]}
          />
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load queues">{loadError}</AdminListAlert>
        ) : undefined
      }
      view={
        data ? <OnboardingIssuesBoard data={data} defaultTab={result?.tab ?? "entities"} /> : null
      }
      empty={
        data && queueTotal === 0 ? (
          <CatalogListEmptyState
            title="All onboarding queues clear"
            description="No entities, artists, KYC sessions, or documents need attention right now."
          />
        ) : null
      }
    />
  );
}
