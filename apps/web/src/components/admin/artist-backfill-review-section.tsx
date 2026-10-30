import { ArtistBackfillTable } from "@/components/admin/artist-backfill-table";
import { getLotArtistBackfillReviewTasks } from "@/lib/data/http/admin.server";
import { EmptyState, Notice } from "@auction/staff-ui";

/** Lots whose artist could not be matched to a profile automatically, one row each. */
export async function ArtistBackfillReviewSection() {
  let tasks: Awaited<ReturnType<typeof getLotArtistBackfillReviewTasks>> = [];
  let loadError: string | null = null;
  try {
    tasks = await getLotArtistBackfillReviewTasks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load review tasks.";
  }

  if (loadError) {
    return (
      <Notice tone="danger" alert title="The review tasks did not load">
        {loadError}
      </Notice>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <EmptyState
          title="Nothing to match"
          description="Every lot's artist has been matched to a profile."
        />
      </div>
    );
  }

  return (
    <ArtistBackfillTable
      rows={tasks.map((task) => ({
        id: task.id,
        lotId: task.targetLotId ?? null,
        title: task.payload.title ? String(task.payload.title) : "Untitled lot",
        classification: task.payload.classification ? String(task.payload.classification) : "",
        hintText: task.payload.hintText ? String(task.payload.hintText) : "",
        ambiguityCount:
          typeof task.payload.ambiguityCount === "number" ? task.payload.ambiguityCount : 0,
        createdAt: task.createdAt,
      }))}
    />
  );
}
