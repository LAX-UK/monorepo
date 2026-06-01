import { AdminDisputesDomainEventsBoard } from "@/components/admin/admin-disputes-domain-events-board";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { disputesDomainEventsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PaginationFooter } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Payment disputes",
  "Stripe dispute-related domain events.",
);

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = disputesDomainEventsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof disputesDomainEventsListController.fetch>>["rows"] = [];
  let hasNextPage = false;
  let loadError: string | null = null;
  try {
    const result = await disputesDomainEventsListController.fetch(query);
    rows = result.rows;
    hasNextPage = result.hasNextPage ?? false;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dispute events.";
  }

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      For capture/refund actions use{" "}
      <Link href="/admin/payments" className="text-primary underline">
        Payments
      </Link>
      .
    </p>
  );

  const pagination =
    !loadError && (query.offset > 0 || hasNextPage) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/disputes", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          hasNextPage
            ? buildListHref("/admin/disputes", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListShell
      title="Payment disputes"
      description="Stripe dispute-related domain events (opened, funds withdrawn, closed). Payloads are redacted per audit policy."
      meta={meta}
      showCommandPaletteHint
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "page", label: "On this page", value: String(rows.length) },
              {
                id: "offset",
                label: "Offset",
                value: String(query.offset),
              },
            ]}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      wrapView={false}
      view={!loadError && rows.length > 0 ? <AdminDisputesDomainEventsBoard rows={rows} /> : null}
      empty={
        !loadError && rows.length === 0 ? (
          <AdminEmptyState title="No disputes" description="No dispute events recorded yet." />
        ) : null
      }
      pagination={pagination}
    />
  );
}
