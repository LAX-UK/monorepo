import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { ConsignmentChecklistRollup } from "@/components/dashboard/seller/consignment-checklist-rollup";
import { SellerAttentionList } from "@/components/dashboard/seller/seller-attention-list";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { organisationHref } from "@/lib/navigation/client-routes";
import { consignmentChecklistFacts } from "@/lib/seller/consignment-checklist-facts";
import { checklistRollupRows } from "@/lib/seller/consignment-checklist-rollup-view";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import { buildSellerAttentionItems } from "@/lib/seller/seller-attention";
import { computeConsignmentChecklist, rollupConsignmentChecklists } from "@auction/domain";
import type { ConsignmentAgreement, ItemSubmission, Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";

const PAGE_LIMIT = 100;

/** Where payout setup lives for the account being sold as. */
function payoutSetupHref(sellerEntityId: string | null, sellingAsOrganisation: boolean): string {
  return sellingAsOrganisation && sellerEntityId
    ? organisationHref("payouts")
    : DASHBOARD_ROUTES.sellerConnect;
}

export default async function SellerOverviewPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/selling" });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, sellingAsOrganisation, bootstrapFailed } = sellerCtx;
  const canSell = sellerCan(sellerCtx, "entity.consignments.read");
  const canCreateSubmission = sellerCan(sellerCtx, "entity.submissions.create");

  const failures: DashboardSliceFailure[] = [];
  let submissions: ItemSubmission[] = [];
  let lots: Lot[] = [];
  let agreements: ConsignmentAgreement[] = [];
  let account: Awaited<ReturnType<typeof loadSellerAccountFacts>> = null;

  if (canSell && sellerEntityId) {
    const c = await getServerDataContainer();
    const [submissionsResult, lotsResult, agreementsResult, accountResult] = await Promise.all([
      c.submissions.listMine({ limit: PAGE_LIMIT, offset: 0 }).then(
        (value) => ({ ok: true as const, value }),
        (reason: unknown) => ({ ok: false as const, reason }),
      ),
      c.sellerLots.list({ sellerId: sellerEntityId, limit: PAGE_LIMIT }).then(
        (value) => ({ ok: true as const, value }),
        (reason: unknown) => ({ ok: false as const, reason }),
      ),
      listServerConsignmentAgreements().catch(() => []),
      loadSellerAccountFacts(sellerCtx).catch(() => null),
    ]);

    if (submissionsResult.ok) submissions = submissionsResult.value;
    else failures.push(submissionsFailureFromCaught(submissionsResult.reason));
    if (lotsResult.ok) lots = lotsResult.value;
    else {
      failures.push(
        describeDashboardSliceFailure(lotsResult.reason, "sellerLots", "Could not load your lots."),
      );
    }
    agreements = agreementsResult;
    account = accountResult;
  }

  // "Before your works can go to sale", across every consignment on its way.
  const agreementBySubmission = new Map(agreements.map((a) => [a.submissionId, a]));
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const rollup = account
    ? rollupConsignmentChecklists(
        submissions.map((submission) => ({
          id: submission.id,
          title: submission.title,
          checklist: computeConsignmentChecklist(
            consignmentChecklistFacts({
              submission,
              agreement: agreementBySubmission.get(submission.id) ?? null,
              account,
              lot: submission.convertedLotId
                ? (lotById.get(submission.convertedLotId) ?? null)
                : null,
            }),
          ),
        })),
      )
    : [];
  const rollupRows = account
    ? checklistRollupRows(rollup, {
        accountKind: account.accountKind,
        organisationName: account.organisationName,
      })
    : [];
  const rollupCovers = new Set(rollup.map((row) => row.id));

  const loadedNothing = failures.length === 2;
  const attention = buildSellerAttentionItems({
    submissions,
    lots,
    // The roll-up already asks for these when a consignment needs them.
    payoutSetupIncomplete: !rollupCovers.has("payouts") && account?.payoutsReady === false,
    identityVerificationNeeded: !rollupCovers.has("identity") && account?.identity === "required",
    payoutSetupHref: payoutSetupHref(sellerEntityId, sellingAsOrganisation),
    canOpenPayoutSetup: sellerCan(sellerCtx, "entity.connect.operate"),
    now: new Date(),
  });

  return (
    <DashboardPage className="space-y-8">
      {/* For an organisation this page is its Home until Home has a page of its own. */}
      {sellingAsOrganisation ? <SetMobileShellTitle title="Home" /> : null}
      <DashboardPageHeader
        title={sellingAsOrganisation ? "Home" : "Overview"}
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="What needs you today, and where to find the rest."
        actions={
          canCreateSubmission ? (
            <Button variant="primary" asChild>
              <Link href={DASHBOARD_ROUTES.submissionsNew}>
                <Plus className="size-4" aria-hidden />
                {DASHBOARD_CTA.newSubmission}
              </Link>
            </Button>
          ) : null
        }
      />

      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}
      {failures.map((failure) => (
        <DashboardSliceErrorAlert key={failure.title} failure={failure} />
      ))}

      {!canSell ? (
        <Alert>
          <AlertTitle>No selling pages for your role</AlertTitle>
          <AlertDescription>
            Your role in this organisation does not include consignments. Ask an owner or admin if
            you need access.
          </AlertDescription>
        </Alert>
      ) : loadedNothing ? null : (
        <>
          <ConsignmentChecklistRollup rows={rollupRows} />
          <SellerAttentionList items={attention} />
        </>
      )}
    </DashboardPage>
  );
}
