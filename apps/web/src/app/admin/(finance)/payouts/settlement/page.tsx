import { PayoutSettlementWorkspace } from "@/components/admin/payout-settlement-workspace";
import { FinanceRuleNotice } from "@/components/admin/seller-proceeds/finance-rule-notice";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { UrlSuccessToast } from "@/components/admin/staff/url-success-toast";
import {
  type SettlementSearchParams,
  loadAdminSettlementPage,
  loadSettlementPreview,
} from "@/lib/admin/finance/load-settlement-page";
import { SETTLEMENT_RESULT_PARAM } from "@/lib/admin/finance/settlement-result";
import { loadFinanceNotice } from "@/lib/admin/seller-proceeds/load-finance-notice";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { SELLER_AGREEMENT_RECORD_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage, Notice } from "@auction/staff-ui";
import { type UserRole, userHasAccessTo } from "@auction/types";
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
  const [{ success, error }, notice, user] = await Promise.all([
    loadAdminSettlementPage(await searchParams),
    loadFinanceNotice(),
    getServerSessionUser().catch(() => null),
  ]);
  const canRecordAgreement =
    user !== null &&
    userHasAccessTo(user.role as UserRole, user.staffRoles, SELLER_AGREEMENT_RECORD_ACCESS);
  const ruleNotice = notice ? (
    <FinanceRuleNotice content={notice.content} dismissCookie={notice.dismissCookie} />
  ) : null;

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
      {...(error || ruleNotice
        ? {
            notice: (
              <div className="flex flex-col gap-3">
                {ruleNotice}
                {error ? (
                  <Notice tone="danger" alert title="The settlement did not run">
                    {error}
                  </Notice>
                ) : null}
              </div>
            ),
          }
        : {})}
    >
      <UrlSuccessToast message={success} param={SETTLEMENT_RESULT_PARAM} />
      <PayoutSettlementWorkspace
        loadPreview={loadSettlementPreview}
        canRecordAgreement={canRecordAgreement}
      />
    </FormPage>
  );
}
