import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { getLotArtistBackfillReviewTasks } from "@/lib/data/http/admin.server";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function LotArtistBackfillReviewPage() {
  let tasks: Awaited<ReturnType<typeof getLotArtistBackfillReviewTasks>> = [];
  let loadError: string | null = null;
  try {
    tasks = await getLotArtistBackfillReviewTasks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load review queue.";
  }

  return (
    <AdminPanelPage
      title="Lot artist backfill review"
      description="Lots that need manual resolution after the SE-P23 classification passes (ambiguous text, corrupt IDs, or legacy user ids in artist_id)."
    >
      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : tasks.length === 0 ? (
        <EmptyState title="Queue clear" description="No pending lot artist backfill tasks." />
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id}>
              <Surface variant="section" padding="md" className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-xs">
                    {t.payload.classification ? String(t.payload.classification) : "unknown"}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {t.createdAt.toLocaleString("en-GB")}
                  </span>
                </div>
                {t.targetLotId ? (
                  <p className="text-sm">
                    Lot{" "}
                    <Link
                      href={`/admin/lots/${t.targetLotId}`}
                      className="font-mono text-primary underline"
                    >
                      {t.targetLotId}
                    </Link>
                  </p>
                ) : null}
                {t.payload.title ? (
                  <p className="text-sm font-medium">{String(t.payload.title)}</p>
                ) : null}
                <pre className="max-h-48 overflow-auto rounded-md bg-surface-container-low p-3 text-xs">
                  {JSON.stringify(t.payload, null, 2)}
                </pre>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </AdminPanelPage>
  );
}
