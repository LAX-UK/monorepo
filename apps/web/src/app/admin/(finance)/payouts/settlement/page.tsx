import { PayoutSettlementWorkspace } from "@/components/admin/payout-settlement-workspace";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { UrlSuccessToast } from "@/components/admin/staff/url-success-toast";
import {
  type SettlementSearchParams,
  loadAdminSettlementPage,
  loadSettlementPreview,
} from "@/lib/admin/finance/load-settlement-page";
import { SETTLEMENT_RESULT_PARAM } from "@/lib/admin/finance/settlement-result";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage, Notice } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Settlement run",
  "Pay one seller now from their captured payments.",
);

export default async function PayoutSettlementPage({
  searchParams,
}: {
  searchParams: Promise<SettlementSearchParams>;
}) {
  const { success, error } = await loadAdminSettlementPage(await searchParams);

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Finance", href: "/admin/finance" },
            { label: "Payouts", href: "/admin/payouts" },
            { label: "Settlement run" },
          ]}
        />
      }
      title="Settlement run"
      description="Pay one seller now from their captured payments. The nightly run settles everyone else."
      {...(error
        ? {
            notice: (
              <Notice tone="danger" alert title="The settlement did not run">
                {error}
              </Notice>
            ),
          }
        : {})}
    >
      <UrlSuccessToast message={success} param={SETTLEMENT_RESULT_PARAM} />
      <PayoutSettlementWorkspace loadPreview={loadSettlementPreview} />
    </FormPage>
  );
}
