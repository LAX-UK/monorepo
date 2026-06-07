import { AdminAmlHitListings } from "@/components/admin/admin-aml-hit-listings";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { formatAmlCategoriesLabel } from "@/lib/admin/status-badge-variants";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { buildAdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

const VERIFF_STATION_BASE =
  process.env.NEXT_PUBLIC_VERIFF_STATION_URL ?? "https://station.veriff.com";

export function AdminUserAmlPanel({ screenings }: { screenings: AdminAmlScreeningRow[] }) {
  const latest = screenings[0] ?? null;
  const queueHref = latest
    ? `/admin/compliance/aml?screening=${encodeURIComponent(latest.id)}`
    : "/admin/compliance/aml";

  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          AML / watchlist screening
        </h3>
        <Link href={queueHref} className="text-xs text-primary underline">
          {latest?.reviewStatus === "pending" ? "Review in queue" : "Open review queue"}
        </Link>
      </div>
      {!latest ? (
        <div className="space-y-2 text-sm text-on-surface-variant">
          <p>No watchlist screenings on record.</p>
          <p className="text-xs">
            If Veriff shows PEP or sanctions results for this client, confirm the PEP &amp;
            Sanctions webhook URL is enabled in the Veriff portal, then backfill the session or wait
            for the next screening webhook.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge domain="amlMatch" status={latest.matchStatus} size="sm" />
            <AdminStatusBadge domain="amlDecision" status={latest.decisionOutcome} size="sm" />
            <AdminStatusBadge domain="amlMonitor" status={latest.monitorStatus} size="sm" />
            {latest.reviewStatus === "pending" ? (
              <AdminStatusBadge
                domain="amlDecision"
                status="pending"
                label="Awaiting review"
                size="sm"
              />
            ) : null}
          </div>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Categories
              </dt>
              <dd>{formatAmlCategoriesLabel(latest.categories)}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Hits</dt>
              <dd className="tabular-nums">{latest.totalHits}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Screened</dt>
              <dd>{formatAdminUserDate(latest.screenedAt)}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Check type
              </dt>
              <dd>{latest.checkType ?? "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Provider session
              </dt>
              <dd className="break-all font-mono text-xs">
                {latest.providerSessionId}{" "}
                <a
                  href={`${VERIFF_STATION_BASE}/verifications/${latest.providerSessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-primary underline"
                >
                  Open in Veriff
                </a>
              </dd>
            </div>
          </dl>
          {latest.hits.length > 0 ? (
            <div>
              <h4 className="font-label text-[10px] uppercase text-on-surface-variant">
                Hit detail
              </h4>
              <div className="mt-2">
                <AdminAmlHitListings hits={latest.hits} compact />
              </div>
            </div>
          ) : null}
          {screenings.length > 1 ? (
            <ul className="divide-y divide-outline-variant/30 border-t border-outline-variant/30 pt-2">
              {screenings.slice(1, 4).map((s) => {
                const row = buildAdminAmlTableRow(s);
                return (
                  <li key={s.id} className="py-2 text-sm text-on-surface-variant">
                    {formatAdminUserDate(s.screenedAt)} · {row.matchStatusLabel} ·{" "}
                    {row.categoriesLabel}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </Surface>
  );
}
