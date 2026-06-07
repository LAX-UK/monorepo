import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { SellerNextActionCard } from "@/components/dashboard/overview/seller-next-action-card";
import { SellerOverviewActivityBand } from "@/components/dashboard/overview/seller-overview-activity-band";
import { SellerOverviewArtistCta } from "@/components/dashboard/overview/seller-overview-artist-cta";
import { SellerOverviewGuideCards } from "@/components/dashboard/overview/seller-overview-guide-cards";
import { SellerOverviewLayout } from "@/components/dashboard/overview/seller-overview-layout";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import {
  loadSellerComplianceChrome,
  shouldShowConnectPageAlert,
} from "@/lib/connect/seller-compliance-chrome.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { resolveSellerNextAction } from "@/lib/seller/resolve-seller-next-action";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { ItemSubmission, ItemSubmissionStatus, Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type UpcomingSaleRow = {
  saleId: string;
  saleTitle: string;
  /** ISO of earliest end time among the seller's lots in this sale (used as the schedule anchor). */
  scheduleIso: string;
  scheduleLabel: string;
  lotsInSale: number;
};

type PayoutForecast = {
  /** Sum of reserve prices for active/scheduled lots that have a reserve set. */
  reservedFloor: string;
  /** Sum of current prices for lots above reserve (best-case if hammer holds now). */
  bestCaseHammer: string;
  lotsWithReserve: number;
  liveLots: number;
};

function safeNumber(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function buildUpcomingSales(
  lots: Lot[],
  saleLookup: Map<string, { id: string; title: string }>,
): UpcomingSaleRow[] {
  const now = Date.now();
  const grouped = new Map<string, { earliest: number; count: number }>();
  for (const lot of lots) {
    if (!lot.saleId) continue;
    if (lot.status !== "active" && lot.status !== "scheduled") continue;
    const endMs = lot.endTime.getTime();
    if (!Number.isFinite(endMs) || endMs < now) continue;
    const existing = grouped.get(lot.saleId);
    if (existing) {
      existing.count += 1;
      if (endMs < existing.earliest) existing.earliest = endMs;
    } else {
      grouped.set(lot.saleId, { earliest: endMs, count: 1 });
    }
  }
  return Array.from(grouped.entries())
    .map(([saleId, info]) => {
      const summary = saleLookup.get(saleId);
      return {
        saleId,
        saleTitle: summary?.title ?? "Untitled sale",
        scheduleIso: new Date(info.earliest).toISOString(),
        scheduleLabel: DATE_FMT.format(new Date(info.earliest)),
        lotsInSale: info.count,
      } satisfies UpcomingSaleRow;
    })
    .sort((a, b) => Date.parse(a.scheduleIso) - Date.parse(b.scheduleIso))
    .slice(0, 3);
}

function buildPayoutForecast(lots: Lot[]): PayoutForecast {
  let reservedFloor = 0;
  let bestCaseHammer = 0;
  let lotsWithReserve = 0;
  let liveLots = 0;
  for (const lot of lots) {
    if (lot.status !== "active" && lot.status !== "scheduled") continue;
    liveLots += 1;
    const reserve = safeNumber(lot.reservePrice);
    const current = safeNumber(lot.currentPrice);
    if (reserve > 0) {
      lotsWithReserve += 1;
      reservedFloor += reserve;
      bestCaseHammer += Math.max(current, reserve);
    } else {
      bestCaseHammer += current;
    }
  }
  return {
    reservedFloor: reservedFloor.toFixed(2),
    bestCaseHammer: bestCaseHammer.toFixed(2),
    lotsWithReserve,
    liveLots,
  };
}

export default async function SellerOverviewPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard/seller" });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const c = await getServerDataContainer();
  let submissionsFailure: DashboardSliceFailure | null = null;
  let lotsFailure: DashboardSliceFailure | null = null;
  let sellerLots: Lot[] = [];
  let submissionCounts: Record<ItemSubmissionStatus, number> = {
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0,
    converted: 0,
  };
  let rows: ItemSubmission[] = [];
  const [subRes, lotsRes] = await Promise.allSettled([
    Promise.all([c.submissions.getSummary(), c.submissions.listMine({ limit: 25, offset: 0 })]),
    sellerEntityId
      ? c.sellerLots.list({ sellerId: sellerEntityId, limit: 100 })
      : Promise.resolve([] as Lot[]),
  ]);
  if (subRes.status === "fulfilled") {
    submissionCounts = subRes.value[0].counts;
    rows = subRes.value[1];
  } else {
    submissionsFailure = submissionsFailureFromCaught(subRes.reason);
  }
  if (lotsRes.status === "fulfilled") {
    sellerLots = lotsRes.value;
  } else if (sellerEntityId) {
    lotsFailure = describeDashboardSliceFailure(
      lotsRes.reason,
      "sellerLots",
      "Could not load your lots.",
    );
  }

  const upcomingSaleIds = Array.from(
    new Set(
      sellerLots
        .filter((lot) => lot.status === "active" || lot.status === "scheduled")
        .map((lot) => lot.saleId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const saleLookup = new Map<string, { id: string; title: string }>();
  if (upcomingSaleIds.length > 0) {
    const results = await Promise.allSettled(upcomingSaleIds.map((id) => c.sales.getWithLots(id)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        saleLookup.set(result.value.sale.id, {
          id: result.value.sale.id,
          title: result.value.sale.title,
        });
      }
    }
  }
  const upcomingSales = buildUpcomingSales(sellerLots, saleLookup);
  const forecast = buildPayoutForecast(sellerLots);

  const complianceChrome = await loadSellerComplianceChrome(user.id);

  let connectPresentation = resolveSellerConnectPresentation({
    connectEnforced: false,
    entity: null,
  });
  if (sellerEntityId) {
    const hub = createOrganisationHubGateway();
    const [clientConfig, entity] = await Promise.all([
      getServerStripeConnectClientConfig(),
      hub.getEntityDetail(sellerEntityId).catch(() => null),
    ]);
    connectPresentation = resolveSellerConnectPresentation({
      connectEnforced: clientConfig.connectEnforced,
      entity: entity ? legalEntityToConnectFields(entity) : null,
    });
  }

  const showConnectAlert = shouldShowConnectPageAlert(complianceChrome, connectPresentation);

  const drafts = submissionCounts.draft;
  const pendingReview = submissionCounts.submitted + submissionCounts.under_review;
  const accepted = submissionCounts.approved;
  const cataloguePrep = submissionCounts.converted;
  const liveLots = sellerLots.filter((lot) => lot.status === "active").length;

  const cards = [
    {
      title: "Draft",
      value: drafts,
      href: "/dashboard/submissions?status=draft",
      hint: "Finish and submit for specialist review",
    },
    {
      title: "Pending review",
      value: pendingReview,
      href: "/dashboard/submissions",
      hint: "Submitted or under specialist review",
    },
    {
      title: "Accepted",
      value: accepted,
      href: "/dashboard/submissions?status=approved",
      hint: "Accepted — catalogue prep starting",
    },
    {
      title: "Catalogue prep",
      value: cataloguePrep,
      href: "/dashboard/submissions?status=converted",
      hint: "Draft lots being prepared",
    },
    {
      title: "Live",
      value: liveLots,
      href: "/dashboard/seller/in-sale",
      hint: "Lots active in sales",
    },
  ];

  const workspaceMeta = await readClientWorkspacePageMeta();
  const nextAction = !submissionsFailure
    ? resolveSellerNextAction({
        submissions: rows,
        connectRequired: showConnectAlert,
      })
    : null;
  const hasAnySubmissions = Object.values(submissionCounts).reduce((sum, n) => sum + n, 0) > 0;

  return (
    <DashboardPage className="space-y-8">
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Seller workspace"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Track consignments from first submission through cataloguing, sale, and settlement."
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {showConnectAlert && connectPresentation.bannerCopy ? (
        <Alert>
          <AlertTitle>{connectPresentation.bannerCopy.title}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{connectPresentation.bannerCopy.description}</span>
            <Button asChild variant="cta" size="sm">
              <Link href={DASHBOARD_ROUTES.sellerConnect}>{DASHBOARD_CTA.openPayoutSetup}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {submissionsFailure ? (
        <div className="space-y-3">
          <DashboardSliceErrorAlert failure={submissionsFailure} />
          <Button variant="secondaryOutline" asChild>
            <Link href={DASHBOARD_ROUTES.submissionsNew}>{DASHBOARD_CTA.newSubmission}</Link>
          </Button>
        </div>
      ) : null}
      {lotsFailure ? <DashboardSliceErrorAlert failure={lotsFailure} /> : null}

      {!submissionsFailure && !hasAnySubmissions ? (
        <DashboardEmptyState
          variant="hero"
          title={DASHBOARD_EMPTY.seller.title}
          description={DASHBOARD_EMPTY.seller.description}
          action={
            <Button variant="primary" asChild>
              <Link href={DASHBOARD_ROUTES.submissionsNew}>
                {DASHBOARD_CTA.newSubmission} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : null}

      {!submissionsFailure && hasAnySubmissions ? (
        <SellerOverviewLayout
          slots={{
            ...(nextAction ? { nextAction: <SellerNextActionCard action={nextAction} /> } : {}),
            kpis: (
              <section
                aria-label="Submission pipeline"
                className="rounded-xl border border-border-hairline bg-surface-container-lowest p-4 sm:p-5"
              >
                <KpiRow
                  track="selling"
                  embedded
                  columns={5}
                  tiles={cards.map((card) => ({
                    id: card.title,
                    label: card.title,
                    value: String(card.value),
                    compareHint: card.hint,
                    semanticTone: card.value > 0 ? "emphasis" : "default",
                    href: card.href,
                    trendSlot: <span className="text-xs font-semibold text-primary">View</span>,
                  }))}
                />
              </section>
            ),
            ...(upcomingSales.length > 0 || forecast.liveLots > 0
              ? {
                  activity: (
                    <SellerOverviewActivityBand upcomingSales={upcomingSales} forecast={forecast} />
                  ),
                }
              : {}),
            guides: <SellerOverviewGuideCards />,
            secondary: <SellerOverviewArtistCta />,
          }}
        />
      ) : null}
    </DashboardPage>
  );
}
