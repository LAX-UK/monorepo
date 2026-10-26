"use client";

import { AtgSettingsSection } from "@/components/admin/atg/atg-settings-section";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminAtgJobStateAction, adminAtgSaleActionResultAction } from "@/lib/actions/admin-atg";
import { adminLotEditHref } from "@/lib/admin/catalog-route-helpers";
import { staffAtgAuctionStatus, staffAtgLotStatus } from "@/lib/admin/staff-kit-status";
import { decimalToMinorUnits } from "@/lib/data/view-models/client-commerce-tab.vm";
import {
  type DataColumn,
  EmptyState,
  type KeyValueItem,
  KeyValueList,
  Notice,
  PrimaryCell,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import {
  type AtgIntegrationStatus,
  type AtgLotSyncView,
  type AtgSaleResultRow,
  type AtgSaleSyncView,
  type AtgSyncAction,
  atgReadinessBlockers,
} from "@auction/types";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  status: AtgIntegrationStatus;
  view: AtgSaleSyncView;
  canManage: boolean;
};

const ATG_JOB_POLL_MS = 3_000;
const ATG_JOB_TIMEOUT_MS = 60_000;

const CONFIRM_COPY: Record<
  AtgSyncAction,
  { title: string; body: string; label: string; tone: "default" | "danger"; success: string }
> = {
  push: {
    title: "Push this sale to ATG?",
    body: "Sends the latest sale and lot details to ATG. On the first push the auction is created as a draft that bidders cannot see until it is published.",
    label: "Push to ATG",
    tone: "default",
    success: "Pushing to ATG",
  },
  publish: {
    title: "Publish on ATG?",
    body: "Pushes the latest catalogue, then publishes the auction on ATG. ATG staff must have approved it in Toolbox first, or ATG refuses. If any lot fails to sync, nothing is published and the failing lots are listed here. ATG has no unpublish: only closing ends the auction, and closing is permanent.",
    label: "Publish",
    tone: "default",
    success: "Publishing on ATG",
  },
  close: {
    title: "Close on ATG?",
    body: "Closes the auction on ATG. This cannot be undone from LAX. Results keep updating for 7 days afterwards. If no lots sold, this sale becomes free to publish on lax.bid.",
    label: "Close auction",
    tone: "danger",
    success: "Closing on ATG",
  },
};

type Waiting = { jobId: string; until: number; slow: boolean };

function actionHint(view: AtgSaleSyncView): string {
  if (view.sellingPlatform === "lax") {
    return "Published on lax.bid. Unpublish it on the sale overview to move bidding to ATG.";
  }
  if (view.remoteStatus === "closed") {
    return "The ATG auction is closed, so nothing more can be sent. Results keep updating for 7 days after closing.";
  }
  if (view.saleCancelled) {
    return view.linked
      ? "This sale is cancelled in LAX, so it can't be pushed or published. Close the ATG auction if it is still open."
      : "This sale is cancelled in LAX, so it can't be sent to ATG.";
  }
  if (!view.linked) {
    return "Pushing creates the auction on ATG as a draft. Bidders only see it after you publish.";
  }
  if (view.remoteStatus === "published") {
    return "Live on ATG. Catalogue changes in LAX re-sync automatically within a few minutes. Once a lot has bids, ATG won't accept changes to its description, reserve, estimates or opening price.";
  }
  return "On ATG as a draft, awaiting ATG approval. Ask ATG staff to approve it in Toolbox, then publish. Changes in LAX re-sync automatically.";
}

function resultsSummary(view: AtgSaleSyncView): { sold: number; total: number; hammer: number } {
  const linked = view.lots.filter((lot) => lot.atgLotId);
  const sold = linked.filter((lot) => lot.sold);
  const hammer = sold.reduce((sum, lot) => sum + Number(lot.hammerPrice ?? 0), 0);
  return { sold: sold.length, total: linked.length, hammer };
}

function resultsByAtgLotId(results: AtgSaleResultRow[]): Map<string, AtgSaleResultRow> {
  const map = new Map<string, AtgSaleResultRow>();
  for (const row of results) {
    if (row.atgLotId) map.set(row.atgLotId, row);
  }
  return map;
}

function lotPriceMinor(lot: AtgLotSyncView): number | null {
  return decimalToMinorUnits(lot.hammerPrice ?? lot.currentMaxBid);
}

/** How a sale stands on the ATG White Label, the actions that move it along and each lot's sync. */
export function SaleAtgTab({ saleId, status, view, canManage }: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [jobFailed, setJobFailed] = useState(false);
  const queuedJob = useRef<string | null>(null);
  const laxOwned = view.sellingPlatform === "lax";
  const resultMap = useMemo(() => resultsByAtgLotId(view.results), [view.results]);

  useEffect(() => {
    if (!waiting) return;
    if (waiting.slow) return;

    let cancelled = false;

    const poll = async () => {
      const result = await adminAtgJobStateAction(waiting.jobId);
      if (cancelled) return;
      const state = result.ok ? result.data?.state : undefined;
      if (state === "done") {
        setWaiting(null);
        router.refresh();
        return;
      }
      if (state === "failed") {
        setWaiting(null);
        setJobFailed(true);
        router.refresh();
        return;
      }
      if (Date.now() >= waiting.until) {
        setWaiting({ ...waiting, slow: true });
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, ATG_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [waiting, router]);

  const closed = view.remoteStatus === "closed";
  const published = view.remoteStatus === "published";
  const syncing = waiting != null && !waiting.slow;
  const settingsDisabled = syncing || laxOwned || view.saleCancelled || closed;
  const readiness = atgReadinessBlockers(view);
  const busy = confirm.busy || syncing;
  const linkedLots = view.lots.filter((lot) => lot.atgLotId).length;
  const failedLotCount = view.lots.filter((lot) => lot.lastError).length;
  const showResults = view.linked && (published || closed);
  const results = showResults ? resultsSummary(view) : null;

  const blockedReason = laxOwned
    ? "Published on lax.bid"
    : closed
      ? "The ATG auction is closed"
      : view.saleCancelled
        ? "This sale is cancelled"
        : undefined;

  function ask(action: AtgSyncAction) {
    const copy = CONFIRM_COPY[action];
    setJobFailed(false);
    queuedJob.current = null;
    confirm.ask({
      title: copy.title,
      description: copy.body,
      confirmLabel: copy.label,
      tone: copy.tone,
      ...(action === "close" ? { stepUpAction: "close this auction on ATG" } : {}),
      run: async () => {
        const result = await adminAtgSaleActionResultAction(saleId, action);
        if (!result.ok) return { ok: false, error: result.error, errorCode: result.errorCode };
        queuedJob.current = result.data?.jobId ?? null;
        return { ok: true };
      },
      success: copy.success,
      onSuccess: () => {
        const jobId = queuedJob.current;
        if (!jobId) {
          router.refresh();
          return;
        }
        setWaiting({ jobId, until: Date.now() + ATG_JOB_TIMEOUT_MS, slow: false });
      },
    });
  }

  const columns = useMemo<DataColumn<AtgLotSyncView>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        sortable: true,
        sortValue: (lot) => lot.lotNumber ?? Number.MAX_SAFE_INTEGER,
        cell: (lot) => (
          <PrimaryCell
            Link={NextLink}
            href={`/admin/lots/${encodeURIComponent(lot.lotId)}`}
            secondary={
              lot.lastError ? (
                <span className="text-staff-danger-fg" title={lot.lastError}>
                  {lot.lastError}
                </span>
              ) : lot.lotNumber != null ? (
                `Lot ${lot.lotNumber}`
              ) : null
            }
          >
            {lot.title}
          </PrimaryCell>
        ),
      },
      {
        id: "state",
        header: "On ATG",
        width: "136px",
        mobile: "badge",
        truncate: false,
        cell: (lot) => {
          const state = staffAtgLotStatus(lot);
          return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>;
        },
      },
      {
        id: "images",
        header: "Images",
        numeric: true,
        width: "88px",
        hideBelow: "md",
        mobile: "hidden",
        cell: (lot) => (lot.atgLotId ? lot.imageCount : null),
      },
      {
        id: "price",
        header: view.lots.some((lot) => lot.hammerPrice != null) ? "Hammer or bid" : "Current bid",
        numeric: true,
        width: "144px",
        mobile: "meta",
        sortable: true,
        sortValue: lotPriceMinor,
        cell: (lot) => <StaffMoney minor={lotPriceMinor(lot)} />,
      },
      ...(showResults
        ? [
            {
              id: "result",
              header: "Result",
              width: "112px",
              mobile: "meta",
              truncate: false,
              cell: (lot: AtgLotSyncView) =>
                lot.sold === true ? "Sold" : lot.sold === false && lot.atgLotId ? "Unsold" : null,
            } satisfies DataColumn<AtgLotSyncView>,
            {
              id: "paddle",
              header: "Paddle",
              numeric: true,
              width: "96px",
              hideBelow: "md",
              mobile: "hidden",
              cell: (lot: AtgLotSyncView) =>
                lot.atgLotId ? (resultMap.get(lot.atgLotId)?.paddleNumber ?? null) : null,
            } satisfies DataColumn<AtgLotSyncView>,
          ]
        : []),
      rowActionsColumn<AtgLotSyncView>({
        actions: (lot) => [
          { id: "open", label: "Open lot", href: `/admin/lots/${encodeURIComponent(lot.lotId)}` },
          ...(canManage
            ? [{ id: "edit", label: "Edit lot", href: adminLotEditHref(lot.lotId) }]
            : []),
        ],
        label: (lot) => `Actions for ${lot.title}`,
        Link: NextLink,
      }),
    ],
    [canManage, resultMap, showResults, view.lots],
  );

  const settings = (
    <AtgSettingsSection
      key={`${view.settings.auctionType}:${view.settings.distribution}`}
      saleId={saleId}
      view={view}
      canManage={canManage}
      disabled={settingsDisabled}
      readiness={readiness}
      onSaved={(pushJobId) => {
        if (pushJobId) {
          setWaiting({ jobId: pushJobId, until: Date.now() + ATG_JOB_TIMEOUT_MS, slow: false });
        }
      }}
    />
  );

  if (!status.enabled) {
    return (
      <div className="flex flex-col gap-6">
        <Section title="ATG White Label">
          <EmptyState
            headingLevel="h3"
            title="ATG sync is turned off"
            description="Set ATG_SYNC_ENABLED on the API and worker to push this sale. Auction type and distribution can still be saved so the sale is ready when sync is enabled."
          />
        </Section>
        {settings}
      </div>
    );
  }

  const auctionStatus = staffAtgAuctionStatus(view.linked ? view.remoteStatus : null);
  const facts: KeyValueItem[] = [
    {
      label: "Status",
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={auctionStatus.tone}>{auctionStatus.label}</StatusBadge>
          {view.sellingPlatform === "atg" ? (
            <StatusBadge tone="info">Selling on ATG</StatusBadge>
          ) : null}
          {view.saleCancelled ? <StatusBadge tone="warning">Sale cancelled</StatusBadge> : null}
        </span>
      ),
    },
    {
      label: "ATG auction ID",
      value: view.atgAuctionId,
      ...(view.atgAuctionId ? { copyValue: view.atgAuctionId } : {}),
    },
    { label: "Lots on ATG", value: `${linkedLots} of ${view.lots.length}`, numeric: true },
    { label: "Last pushed", value: <StaffDate value={view.lastSyncedAt} withTime /> },
    { label: "Published", value: <StaffDate value={view.publishedAt} withTime /> },
    { label: "Closed", value: <StaffDate value={view.closedAt} withTime /> },
    { label: "Last results update", value: <StaffDate value={view.lastPolledAt} withTime /> },
    ...(results
      ? [
          {
            label: "Sold on ATG",
            value: `${results.sold} of ${results.total} lots`,
            numeric: true,
          },
          {
            label: "Total hammer",
            value: <StaffMoney minor={Math.round(results.hammer * 100)} />,
            numeric: true,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {laxOwned ? (
        <Notice
          tone="warning"
          title="Published on lax.bid"
          actions={
            <StaffButton asChild size="sm" variant="secondary">
              <Link href={`/admin/sales/${encodeURIComponent(saleId)}`}>Open overview</Link>
            </StaffButton>
          }
        >
          Unpublish the sale on the overview before pushing or publishing on ATG.
        </Notice>
      ) : null}

      {view.lastError && !syncing ? (
        <Notice tone="danger" alert title="The last sync reported a problem">
          {failedLotCount > 0 ? (
            // Each lot's own error is on its row below; say it once.
            `${failedLotCount === 1 ? "One lot" : `${failedLotCount} lots`} did not sync. ${failedLotCount === 1 ? "It is" : "They are"} marked in the list of lots.`
          ) : (
            <span className="whitespace-pre-line">{view.lastError}</span>
          )}
        </Notice>
      ) : null}

      {jobFailed ? (
        <Notice tone="danger" alert title="That ATG action did not go through">
          The ATG job failed. Check the last error above.
        </Notice>
      ) : null}

      {waiting ? (
        <Notice
          tone={waiting.slow ? "warning" : "info"}
          title={waiting.slow ? "ATG is taking longer than usual" : "Syncing with ATG"}
        >
          {waiting.slow
            ? "Refresh the page later to see the result."
            : "This page updates when ATG has finished."}
        </Notice>
      ) : null}

      <Section
        title="ATG White Label"
        description={actionHint(view)}
        {...(status.whiteLabelBaseUrl
          ? {
              action: (
                <StaffButton asChild size="sm" variant="secondary">
                  <a href={status.whiteLabelBaseUrl} target="_blank" rel="noreferrer">
                    Open White Label
                    <ExternalLink aria-hidden />
                  </a>
                </StaffButton>
              ),
            }
          : {})}
      >
        <KeyValueList items={facts} columns={2} />
        {canManage ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-staff-line-subtle pt-4">
            <StaffButton
              size="sm"
              variant="primary"
              loading={busy}
              {...(blockedReason ? { disabledReason: blockedReason } : {})}
              onClick={() => ask("push")}
            >
              {view.linked ? "Push changes" : "Push to ATG"}
            </StaffButton>
            <StaffButton
              size="sm"
              variant="secondary"
              loading={busy}
              {...(blockedReason
                ? { disabledReason: blockedReason }
                : published
                  ? { disabledReason: "Already published" }
                  : {})}
              onClick={() => ask("publish")}
            >
              Publish on ATG
            </StaffButton>
            <StaffButton
              size="sm"
              variant="danger-secondary"
              loading={busy}
              {...(closed || !view.linked
                ? { disabledReason: closed ? "The ATG auction is closed" : "Not on ATG yet" }
                : {})}
              onClick={() => ask("close")}
            >
              Close on ATG
            </StaffButton>
          </div>
        ) : null}
      </Section>

      {settings}

      <RelatedRecordsSection
        id="atg-lots"
        density="comfortable"
        title="Lots"
        description="Cancelled and deleted lots are not sent to ATG."
        label="Lots on ATG"
        columns={columns}
        data={view.lots}
        getRowId={(lot) => lot.lotId}
        defaultSort={{ columnId: "lot", direction: "asc" }}
        empty={{
          title: "No lots in this sale",
          description:
            "Lots appear here once they are added to the sale, and are sent to ATG when you push.",
        }}
      />
      {confirm.dialog}
    </div>
  );
}
