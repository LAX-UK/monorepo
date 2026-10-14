"use client";

import { atgLotState } from "@/components/admin/atg/atg-lot-state";
import { AtgStatusBadge } from "@/components/admin/atg/atg-status-badge";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { adminAtgJobStateAction, adminAtgSaleActionResultAction } from "@/lib/actions/admin-atg";
import { adminLotEditHref } from "@/lib/admin/catalog-route-helpers";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import type {
  AtgIntegrationStatus,
  AtgSaleResultRow,
  AtgSaleSyncView,
  AtgSyncAction,
} from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { EmptyState } from "@auction/ui/components/empty-state";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type Props = {
  saleId: string;
  status: AtgIntegrationStatus;
  view: AtgSaleSyncView;
  canManage: boolean;
};

const ATG_JOB_POLL_MS = 3_000;
const ATG_JOB_TIMEOUT_MS = 60_000;

const CONFIRM_COPY: Record<
  Exclude<AtgSyncAction, "push">,
  { title: string; body: string; label: string; tone: "warning" | "danger" }
> = {
  publish: {
    title: "Publish on ATG?",
    body: "Pushes the latest catalogue, then publishes the auction on the ATG White Label so bidders can see it. If any lot fails to sync, nothing is published and the failing lots are listed here. ATG has no unpublish — only Close ends the auction, and Close is permanent.",
    label: "Publish",
    tone: "warning",
  },
  close: {
    title: "Close on ATG?",
    body: "Closes the auction on ATG. This cannot be undone from LAX. Results keep updating for 7 days afterwards. If no lots sold, this sale becomes free to publish on lax.bid.",
    label: "Close auction",
    tone: "danger",
  },
};

const QUEUED_COPY: Record<AtgSyncAction, string> = {
  push: "Pushing to ATG",
  publish: "Publishing on ATG",
  close: "Closing on ATG",
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
    return "Live on ATG. Catalogue changes in LAX re-sync automatically within a few minutes.";
  }
  return "On ATG as a draft. Publish when the catalogue is ready. Changes in LAX re-sync automatically.";
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

export function SaleAtgTab({ saleId, status, view, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Exclude<AtgSyncAction, "push"> | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
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
        notify.error("The ATG job failed. Check the last error below.");
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

  if (!status.enabled) {
    return (
      <CatalogDetailTabPanel title="ATG White Label">
        <EmptyState
          title="ATG sync is turned off"
          description="Set ATG_SYNC_ENABLED on the API and worker to push this sale to the ATG White Label."
        />
      </CatalogDetailTabPanel>
    );
  }

  const closed = view.remoteStatus === "closed";
  const published = view.remoteStatus === "published";
  const syncing = waiting != null && !waiting.slow;
  const busy = pending || syncing;
  const linkedLots = view.lots.filter((lot) => lot.atgLotId).length;
  const showResults = view.linked && (published || closed);
  const results = showResults ? resultsSummary(view) : null;
  const atgActionsBlocked = laxOwned || closed || view.saleCancelled;

  function run(action: AtgSyncAction) {
    startTransition(async () => {
      const result = await adminAtgSaleActionResultAction(saleId, action);
      setConfirm(null);
      if (!result.ok) {
        notify.error(result.error);
        router.refresh();
        return;
      }
      notify.success(QUEUED_COPY[action], {
        description: "This page updates when ATG has finished.",
      });
      if (!result.data) {
        router.refresh();
        return;
      }
      setWaiting({
        jobId: result.data.jobId,
        until: Date.now() + ATG_JOB_TIMEOUT_MS,
        slow: false,
      });
    });
  }

  const confirmCopy = confirm ? CONFIRM_COPY[confirm] : null;

  return (
    <CatalogDetailTabPanel
      title="ATG White Label"
      description="Push this sale and its lots to ATG, publish or close it, and follow bids and results."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <AtgStatusBadge status={view.linked ? view.remoteStatus : null} />
          {view.sellingPlatform === "atg" ? (
            <StatusBadge variant="info">Selling on ATG</StatusBadge>
          ) : null}
          {view.saleCancelled ? <StatusBadge variant="warning">Sale cancelled</StatusBadge> : null}
          {status.whiteLabelBaseUrl ? (
            <a
              href={status.whiteLabelBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              Open White Label
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>

        {laxOwned ? (
          <Alert variant="warning">
            <AlertTitle>Published on lax.bid</AlertTitle>
            <AlertDescription>
              Unpublish the sale on the{" "}
              <Link
                href={`/admin/sales/${saleId}`}
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                overview
              </Link>{" "}
              before pushing or publishing on ATG.
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="ATG auction ID" value={view.atgAuctionId ?? "—"} mono />
          <Detail label="Lots on ATG" value={`${linkedLots} of ${view.lots.length}`} />
          <Detail label="Last pushed" value={formatDateTime(view.lastSyncedAt)} />
          <Detail label="Published" value={formatDateTime(view.publishedAt)} />
          <Detail label="Closed" value={formatDateTime(view.closedAt)} />
          <Detail label="Last results update" value={formatDateTime(view.lastPolledAt)} />
          {results ? (
            <>
              <Detail label="Sold on ATG" value={`${results.sold} of ${results.total} lots`} />
              <Detail label="Total hammer" value={formatMoney(results.hammer)} />
            </>
          ) : null}
        </dl>

        {view.lastError && !syncing ? (
          <Alert variant="destructive">
            <AlertTitle>Last sync reported a problem</AlertTitle>
            <AlertDescription className="whitespace-pre-line">{view.lastError}</AlertDescription>
          </Alert>
        ) : null}

        {canManage ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busy || atgActionsBlocked || (closed && !view.saleCancelled)}
                onClick={() => run("push")}
              >
                {view.linked ? "Push changes to ATG" : "Push to ATG"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || atgActionsBlocked || published}
                onClick={() => setConfirm("publish")}
              >
                {published ? "Published" : "Publish on ATG"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || closed || !view.linked}
                onClick={() => setConfirm("close")}
              >
                Close on ATG
              </Button>
              <SyncProgress waiting={waiting} />
            </div>
            <p className="text-sm text-on-surface-variant">{actionHint(view)}</p>
          </div>
        ) : null}

        {view.lots.length === 0 ? (
          <EmptyState
            title="No lots in this sale"
            description="Cancelled and deleted lots are not sent to ATG."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Lot</TableHeaderCell>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>ATG</TableHeaderCell>
                <TableHeaderCell>Images</TableHeaderCell>
                <TableHeaderCell>Current / hammer</TableHeaderCell>
                {showResults ? (
                  <>
                    <TableHeaderCell>Result</TableHeaderCell>
                    <TableHeaderCell>Paddle</TableHeaderCell>
                  </>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {view.lots.map((lot) => {
                const state = atgLotState(lot);
                const resultRow = lot.atgLotId ? resultMap.get(lot.atgLotId) : undefined;
                return (
                  <TableRow key={lot.lotId}>
                    <TableCell>{lot.lotNumber ?? "—"}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="block truncate">{lot.title}</span>
                      {lot.lastError ? (
                        <span className="line-clamp-2 text-xs text-error" title={lot.lastError}>
                          {lot.lastError}
                        </span>
                      ) : null}
                      {lot.lastError && canManage ? (
                        <Link
                          href={adminLotEditHref(lot.lotId)}
                          className="text-xs font-medium text-link underline-offset-4 hover:underline"
                        >
                          Edit lot
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
                    </TableCell>
                    <TableCell>{lot.atgLotId ? lot.imageCount : "—"}</TableCell>
                    <TableCell>
                      {lot.hammerPrice != null
                        ? formatMoney(lot.hammerPrice)
                        : lot.currentMaxBid != null
                          ? formatMoney(lot.currentMaxBid)
                          : "—"}
                    </TableCell>
                    {showResults ? (
                      <>
                        <TableCell>
                          {lot.sold === true
                            ? "Sold"
                            : lot.sold === false && lot.atgLotId
                              ? "Unsold"
                              : "—"}
                        </TableCell>
                        <TableCell>{resultRow?.paddleNumber ?? "—"}</TableCell>
                      </>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {confirmCopy ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.label}
          tone={confirmCopy.tone}
          loading={pending}
          onConfirm={() => {
            if (confirm) run(confirm);
          }}
        />
      ) : null}
    </CatalogDetailTabPanel>
  );
}

function SyncProgress({ waiting }: { waiting: Waiting | null }) {
  return (
    <output aria-live="polite" className="text-sm text-on-surface-variant">
      {waiting == null ? null : waiting.slow ? (
        "ATG is taking longer than usual. Refresh the page later to see the result."
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Loader2Icon className="size-4 motion-safe:animate-spin" aria-hidden />
          Syncing with ATG…
        </span>
      )}
    </output>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
        {label}
      </dt>
      <dd className={mono ? "break-all font-mono text-xs text-on-surface" : "text-on-surface"}>
        {value}
      </dd>
    </div>
  );
}
