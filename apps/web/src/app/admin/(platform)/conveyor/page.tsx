import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { AdminConveyorTableBoard } from "@/components/admin/conveyor-board";
import { ConveyorKanbanBoard } from "@/components/admin/conveyor-board/kanban";
import { ConveyorLayoutToggle } from "@/components/admin/conveyor-board/layout-toggle";
import { conveyorListController } from "@/lib/admin/admin-list-controllers";
import { buildConveyorColumns } from "@/lib/admin/conveyor-pipeline.vm";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

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
        {viewTable ? (
          <AdminConveyorTableBoard rows={rows} />
        ) : (
          <ConveyorKanbanBoard columns={columns} />
        )}
      </div>
    ) : null;

  return (
    <CatalogListShell
      className="max-w-[1600px]"
      title="Conveyor"
      description="Single view of seller submissions through specialist review, catalogue build, live sale, and settlement hand-off."
      kpiStrip={
        !loadError && rows.length > 0 ? (
          <AdminListKpiStrip
            ariaLabel="Conveyor pipeline summary"
            tiles={[
              { label: "Submissions", value: rows.length },
              { label: "In pipeline", value: pipelineTotal },
              { label: "Stages", value: columns.length },
            ]}
          />
        ) : null
      }
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
