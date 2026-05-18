import { AdminListPage } from "@/components/admin/admin-list-page";
import { conveyorListController } from "@/lib/admin/admin-list-controllers";
import { buildConveyorColumns } from "@/lib/admin/conveyor-pipeline.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

export default async function AdminConveyorPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = conveyorListController.parseQuery(sp);

  let loadError: string | null = null;
  let rows: Awaited<ReturnType<typeof conveyorListController.fetch>>["rows"] = [];
  try {
    const result = await conveyorListController.fetch(query);
    rows = result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load pipeline.";
  }

  const columns = buildConveyorColumns(rows);

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load conveyor</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const kanban = (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <section
          key={col.id}
          className="flex w-[min(100%,18rem)] shrink-0 flex-col rounded-lg border border-outline-variant/25 bg-surface-container-lowest/60"
        >
          <header className="border-b border-border-hairline px-3 py-3">
            <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              {col.title}
            </h2>
            <p className="mt-1 font-body text-[11px] leading-snug text-on-surface-variant">
              {col.hint}
            </p>
            <p className="mt-2 font-mono text-[10px] text-secondary">{col.items.length}</p>
          </header>
          <ul className="flex max-h-[70vh] min-h-[8rem] flex-col gap-2 overflow-y-auto p-2">
            {col.items.length === 0 ? (
              <li className="px-1 py-4 text-center font-body text-xs text-on-surface-variant">—</li>
            ) : (
              col.items.map((item) => (
                <li
                  key={`${col.id}-${item.submissionId}`}
                  className="rounded-md border border-border-hairline bg-surface px-2 py-2"
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
  );

  const empty =
    !loadError && rows.length === 0 ? (
      <EmptyState
        title="Pipeline is empty"
        description="No submissions in the conveyor view yet."
      />
    ) : null;

  const view = !loadError && rows.length > 0 ? kanban : null;

  return (
    <AdminListPage
      className="max-w-[1600px]"
      title="Conveyor"
      description="Single view of seller submissions through specialist review, catalogue build, live sale, and settlement hand-off. Rows are the most recently updated first."
      errorAlert={errorAlert}
      view={view}
      empty={empty}
    />
  );
}
