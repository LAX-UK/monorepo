import { ManualReviewStaffList } from "@/components/admin/payments/manual-review-staff-list";
import { PaymentsStaffList } from "@/components/admin/payments/payments-staff-list";
import type { PaymentsListSearchParams } from "@/lib/admin/build-payments-list-page-model";
import { loadAdminPaymentsListPage } from "@/lib/admin/finance/load-payments-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Payments",
  "Capture, review, and reconcile buyer payments.",
);

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<PaymentsListSearchParams>;
}) {
  const page = await loadAdminPaymentsListPage(await searchParams);

  if (page.mode === "manual-review") {
    return (
      <ManualReviewStaffList
        search={page.search}
        rows={page.rows}
        queueSize={page.queueSize}
        reasonFilter={page.reasonFilter}
        summary={page.summary}
        attentionCounts={page.attentionCounts}
        canOpenComplianceQueues={page.canOpenComplianceQueues}
        canResolveManualReview={page.canResolveManualReview}
        loadError={page.loadError}
      />
    );
  }

  return (
    <PaymentsStaffList
      search={page.search}
      view={page.view}
      rows={page.rows}
      summary={page.summary}
      attentionCounts={page.attentionCounts}
      canWritePayments={page.canWritePayments}
      exportFilters={page.exportFilters}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
