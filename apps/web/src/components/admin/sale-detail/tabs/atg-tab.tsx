"use client";

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
import { adminAtgSaleActionResultAction } from "@/lib/actions/admin-atg";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import type { AtgIntegrationStatus, AtgSaleSyncView, AtgSyncAction } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  saleId: string;
  status: AtgIntegrationStatus;
  view: AtgSaleSyncView;
  canManage: boolean;
};

const CONFIRM_COPY: Record<
  Exclude<AtgSyncAction, "push">,
  { title: string; body: string; label: string; tone: "warning" | "danger" }
> = {
  publish: {
    title: "Publish on ATG?",
    body: "Pushes the latest catalogue, then publishes the auction on the ATG White Label. Bidders can see it once ATG processes the request.",
    label: "Publish",
    tone: "warning",
  },
  close: {
    title: "Close on ATG?",
    body: "Closes the auction on ATG. This cannot be undone from LAX; results keep polling afterwards.",
    label: "Close auction",
    tone: "danger",
  },
};

const QUEUED_COPY: Record<AtgSyncAction, string> = {
  push: "ATG push queued",
  publish: "ATG publish queued",
  close: "ATG close queued",
};

export function SaleAtgTab({ saleId, status, view, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Exclude<AtgSyncAction, "push"> | null>(null);

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
  const linkedLots = view.lots.filter((lot) => lot.atgLotId).length;

  function run(action: AtgSyncAction) {
    startTransition(async () => {
      const result = await adminAtgSaleActionResultAction(saleId, action);
      setConfirm(null);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(QUEUED_COPY[action], {
        description: "The worker syncs in the background. Refresh to see progress.",
      });
      router.refresh();
    });
  }

  const confirmCopy = confirm ? CONFIRM_COPY[confirm] : null;

  return (
    <CatalogDetailTabPanel
      title="ATG White Label"
      description="Push this sale and its lots to ATG, publish or close it, and follow bids and results. Linked sales re-sync automatically when the catalogue changes."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <AtgStatusBadge status={view.linked ? view.remoteStatus : null} />
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

        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="ATG auction ID" value={view.atgAuctionId ?? "—"} mono />
          <Detail label="Lots on ATG" value={`${linkedLots} of ${view.lots.length}`} />
          <Detail label="Last pushed" value={formatDateTime(view.lastSyncedAt)} />
          <Detail label="Published" value={formatDateTime(view.publishedAt)} />
          <Detail label="Closed" value={formatDateTime(view.closedAt)} />
          <Detail label="Last results poll" value={formatDateTime(view.lastPolledAt)} />
        </dl>

        {view.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Last sync reported a problem</AlertTitle>
            <AlertDescription className="whitespace-pre-line">{view.lastError}</AlertDescription>
          </Alert>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || closed} onClick={() => run("push")}>
              {view.linked ? "Push changes to ATG" : "Push to ATG"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || closed || published}
              onClick={() => setConfirm("publish")}
            >
              Publish on ATG
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || closed || !view.linked}
              onClick={() => setConfirm("close")}
            >
              Close on ATG
            </Button>
          </div>
        ) : null}

        {view.lots.length === 0 ? (
          <EmptyState title="No lots in this sale" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Lot</TableHeaderCell>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>ATG</TableHeaderCell>
                <TableHeaderCell>Images</TableHeaderCell>
                <TableHeaderCell>Bids</TableHeaderCell>
                <TableHeaderCell>Current / hammer</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {view.lots.map((lot) => (
                <TableRow key={lot.lotId}>
                  <TableCell>{lot.lotNumber ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{lot.title}</TableCell>
                  <TableCell>
                    {lot.lastError ? (
                      <span className="text-error" title={lot.lastError}>
                        Error
                      </span>
                    ) : lot.atgLotId ? (
                      (lot.remoteStatus ?? "Linked")
                    ) : (
                      "Not pushed"
                    )}
                  </TableCell>
                  <TableCell>{lot.atgLotId ? lot.imageCount : "—"}</TableCell>
                  <TableCell>{lot.numberOfBids ?? "—"}</TableCell>
                  <TableCell>
                    {lot.hammerPrice != null
                      ? `${formatMoney(lot.hammerPrice)}${lot.sold ? " (sold)" : ""}`
                      : lot.currentMaxBid != null
                        ? formatMoney(lot.currentMaxBid)
                        : "—"}
                  </TableCell>
                </TableRow>
              ))}
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
