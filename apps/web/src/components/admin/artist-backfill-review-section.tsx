import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import { getLotArtistBackfillReviewTasks } from "@/lib/data/http/admin.server";
import Link from "next/link";

export async function ArtistBackfillReviewSection() {
  let tasks: Awaited<ReturnType<typeof getLotArtistBackfillReviewTasks>> = [];
  let loadError: string | null = null;
  try {
    tasks = await getLotArtistBackfillReviewTasks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load review tasks.";
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  if (tasks.length === 0) {
    return (
      <AdminEmptyState title="All clear" description="No pending lot artist backfill tasks." />
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((t) => {
        const when = formatAdminTableDateTime(t.createdAt, "timestamp");
        return (
          <CatalogMobileCardShell
            key={t.id}
            id={t.id}
            title={t.payload.title ? String(t.payload.title) : "Backfill task"}
            selectionLabel={`Select backfill task ${t.id}`}
            footer={
              t.targetLotId ? (
                <Link
                  href={`/admin/lots/${t.targetLotId}`}
                  className="font-mono text-sm text-link underline"
                >
                  Open lot {t.targetLotId.slice(0, 8)}…
                </Link>
              ) : undefined
            }
          >
            <div className="space-y-2 font-body text-sm text-on-surface-variant">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-xs">
                  {t.payload.classification ? String(t.payload.classification) : "unknown"}
                </span>
                <time dateTime={when.iso ?? undefined} title={when.title}>
                  {when.primary}
                </time>
              </div>
              <pre className="max-h-48 overflow-auto rounded-md bg-surface-container-low p-3 text-xs">
                {JSON.stringify(t.payload, null, 2)}
              </pre>
            </div>
          </CatalogMobileCardShell>
        );
      })}
    </ul>
  );
}
