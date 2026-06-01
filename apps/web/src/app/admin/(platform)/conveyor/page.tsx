import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { AdminConveyorTableBoard } from "@/components/admin/conveyor-board";
import { ConveyorLayoutToggle } from "@/components/admin/conveyor-board/layout-toggle";
import { conveyorListController } from "@/lib/admin/admin-list-controllers";
import { buildConveyorColumns } from "@/lib/admin/conveyor-pipeline.vm";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Conveyor",
  "Pipeline view of submissions through review, catalogue, sale, and settlement.",
);

export default async function AdminConveyorPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const viewTable = sp.view === "table";
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
  const pipelineTotal = columns.reduce((sum, col) => sum + col.items.length, 0);

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load conveyor">{loadError ?? error}</AdminListAlert>
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
      <CatalogListEmptyState
        title="Pipeline is empty"
        description="No submissions in the conveyor view yet."
      />
    ) : null;

  const view =
    !loadError && rows.length > 0 ? (
      <div className="space-y-4">
        <ConveyorLayoutToggle viewTable={viewTable} />
        {viewTable ? <AdminConveyorTableBoard rows={rows} /> : kanban}
      </div>
    ) : null;

  return (
    <CatalogListShell
      className="max-w-[1600px]"
      title="Conveyor"
      description="Single view of seller submissions through specialist review, catalogue build, live sale, and settlement hand-off."
      showCommandPaletteHint
      mobileSummary={
        !loadError && rows.length > 0 ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "submissions", label: "Submissions", value: String(rows.length) },
              { id: "pipeline", label: "In pipeline", value: String(pipelineTotal) },
              {
                id: "view",
                label: "View",
                value: viewTable ? "Table" : "Kanban",
              },
            ]}
          />
        ) : null
      }
      errorAlert={errorAlert}
      empty={empty}
    >
      {view}
    </CatalogListShell>
  );
}
