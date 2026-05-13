import { AppScreen } from "@/components/dashboard/dashboard-page";
import { buildConveyorColumns } from "@/lib/admin/conveyor-pipeline.vm";
import { getAdminConveyorPipeline } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default async function AdminConveyorPage() {
  let loadError: string | null = null;
  let rows: Awaited<ReturnType<typeof getAdminConveyorPipeline>> = [];
  try {
    rows = await getAdminConveyorPipeline({ limit: 250 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load pipeline.";
  }

  const columns = buildConveyorColumns(rows);

  return (
    <AppScreen className="max-w-[1600px] space-y-6">
      <PageHeader
        title="Conveyor"
        description="Single view of seller submissions through specialist review, catalogue build, live sale, and settlement hand-off. Rows are the most recently updated first."
      />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load conveyor</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <section
            key={col.id}
            className="flex w-[min(100%,18rem)] shrink-0 flex-col rounded-lg border border-outline-variant/25 bg-surface-container-lowest/60"
          >
            <header className="border-b border-outline-variant/20 px-3 py-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">
                {col.title}
              </h2>
              <p className="mt-1 font-body text-[11px] leading-snug text-on-surface-variant">
                {col.hint}
              </p>
              <p className="mt-2 font-mono text-[10px] text-secondary">{col.items.length}</p>
            </header>
            <ul className="flex max-h-[70vh] min-h-[8rem] flex-col gap-2 overflow-y-auto p-2">
              {col.items.length === 0 ? (
                <li className="px-1 py-4 text-center font-body text-xs text-on-surface-variant">
                  —
                </li>
              ) : (
                col.items.map((item) => (
                  <li
                    key={`${col.id}-${item.submissionId}`}
                    className="rounded-md border border-outline-variant/15 bg-surface px-2 py-2"
                  >
                    <Link
                      href={`/admin/submissions/${item.submissionId}`}
                      className="line-clamp-2 font-body text-sm font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                      {item.submissionStatus.replaceAll("_", " ")}
                      {item.lotStatus ? ` · lot ${item.lotStatus}` : ""}
                    </p>
                    {item.lotId ? (
                      <Link
                        href={`/admin/lots/${item.lotId}`}
                        className="mt-1 inline-block font-label text-[10px] uppercase tracking-wide text-secondary hover:text-primary"
                      >
                        Open lot
                      </Link>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      {!loadError && rows.length === 0 ? (
        <EmptyState title="No submissions yet" description="Nothing in the pipeline to display." />
      ) : null}
    </AppScreen>
  );
}
