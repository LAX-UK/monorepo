import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { sumCapturedPayments } from "@/lib/admin/admin-user-metrics";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import type { AdminPaymentRow, AdminUserBidRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/format-currency";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntity, Lot } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

function PanelHeader({ title, summary }: { title: string; summary?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <AdminSectionLabel>{title}</AdminSectionLabel>
      {summary ? (
        <span className="font-headline text-lg tabular-nums text-on-surface">{summary}</span>
      ) : null}
    </div>
  );
}

export function AdminUserPaymentsPanel({ payments }: { payments: AdminPaymentRow[] }) {
  const lifetime = sumCapturedPayments(payments);
  const recentPayments = [...payments]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <PanelHeader
        title="Payments"
        {...(lifetime > 0 ? { summary: formatMoney(lifetime.toFixed(2)) } : {})}
      />
      <p className="font-body text-xs text-on-surface-variant">Lifetime spend (captured)</p>
      {recentPayments.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No payments for this buyer yet.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/15 rounded-md border border-border-hairline">
          {recentPayments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/lots/${p.lotId}`}
                  className="font-medium text-primary hover:underline"
                >
                  Lot {p.lotId.slice(0, 8)}…
                </Link>
                <p className="text-xs text-on-surface-variant">
                  {formatAdminUserDate(p.createdAt.toISOString())}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-medium">{formatMoney(p.amount)}</span>
                <AdminStatusBadge domain="payment" status={p.status} size="sm" />
                {p.xeroOnlineInvoiceUrl ? (
                  <a
                    href={p.xeroOnlineInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Invoice
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUserBidsPanel({ bids }: { bids: AdminUserBidRow[] }) {
  return (
    <div className="space-y-3">
      <PanelHeader title="Bids" {...(bids.length > 0 ? { summary: String(bids.length) } : {})} />
      {bids.length === 0 ? (
        <AdminEmptyState title="No bids" description="This client has not placed any bids yet." />
      ) : (
        <ul className="divide-y divide-outline-variant/15 rounded-md border border-border-hairline">
          {bids.map((bid) => (
            <li
              key={bid.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/lots/${bid.lotId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {bid.lotTitle}
                </Link>
                {bid.saleTitle ? (
                  <p className="truncate text-xs text-on-surface-variant">{bid.saleTitle}</p>
                ) : null}
                <p className="text-xs text-on-surface-variant">
                  {formatAdminUserDate(bid.createdAt.toISOString())}
                  {bid.placedVia ? ` · ${bid.placedVia}` : ""}
                  {bid.isAutoBid ? " · auto" : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-medium">{formatMoney(bid.amount)}</span>
                {bid.isWinning ? (
                  <AdminStatusBadge domain="lot" status="active" label="Winning" size="sm" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUserWonLotsPanel({ wonLots }: { wonLots: Lot[] }) {
  return (
    <div className="space-y-3">
      <PanelHeader
        title="Won lots"
        {...(wonLots.length > 0 ? { summary: String(wonLots.length) } : {})}
      />
      {wonLots.length === 0 ? (
        <AdminEmptyState title="No wins" description="This client has not won any lots yet." />
      ) : (
        <ul className="divide-y divide-outline-variant/15 rounded-md border border-border-hairline">
          {wonLots.map((lot) => (
            <li
              key={lot.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <Link
                href={`/admin/lots/${lot.id}`}
                className="min-w-0 truncate text-sm font-medium text-primary hover:underline"
              >
                {lot.title}
              </Link>
              <span className="text-xs text-on-surface-variant">
                {formatMoney(lot.currentPrice)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUserLegalEntitiesPanel({ legalEntities }: { legalEntities: LegalEntity[] }) {
  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <PanelHeader
        title="Legal entities"
        {...(legalEntities.length > 0 ? { summary: String(legalEntities.length) } : {})}
      />
      {legalEntities.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No seller organisations created by this user.
        </p>
      ) : (
        <ul className="space-y-3">
          {legalEntities.map((entity) => (
            <li
              key={entity.id}
              className="rounded-md border border-border-hairline bg-surface-container-lowest px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/legal-entities/${entity.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {entity.displayName}
                </Link>
                <AdminStatusBadge domain="legalEntity" status={entity.status} size="sm" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const gap = getConnectGapState(entity);
                  return (
                    <>
                      <AdminStatusBadge
                        domain="legalEntity"
                        status={
                          gap.stage === "ready" || gap.stage === "managed_by_lax"
                            ? "approved"
                            : "under_review"
                        }
                        label={connectGapStageLabel(gap.stage)}
                        size="sm"
                      />
                      {gap.missing.length > 0 ? (
                        <AdminStatusBadge
                          domain="legalEntity"
                          status="restricted"
                          label={`${gap.missing.length} requirement(s) due`}
                          size="sm"
                        />
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
