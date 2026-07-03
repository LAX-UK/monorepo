import type { ExportEntityType, ExportFormat, ExportPhase, ExportStatus } from "@auction/exports";
import { exportFilename } from "@auction/exports";
import type { ExportProvider } from "../../exports/types.js";
import type { IExportProgressStore } from "./export-progress.store.js";
import type { ExportJobRow, ExportJobView } from "./export-types.js";

export class ExportJobViewMapper {
  constructor(
    private readonly progressStore: IExportProgressStore,
    private readonly providers: Map<ExportEntityType, ExportProvider>,
  ) {}

  async toJobView(row: ExportJobRow): Promise<ExportJobView> {
    const provider = this.providers.get(row.entityType as ExportEntityType);
    const filterSummary = provider
      ? provider.filterSummary(
          {
            userId: row.userId,
            userRole: row.userRole,
            userStaffRole: row.userStaffRole,
          },
          row.filters as Record<string, unknown>,
        )
      : undefined;
    return this.buildJobView(row, await this.progressStore.read(row.id), filterSummary);
  }

  async toJobListView(row: ExportJobRow): Promise<ExportJobView> {
    const isActive = row.status === "pending" || row.status === "processing";
    return this.buildJobView(row, isActive ? await this.progressStore.read(row.id) : {}, undefined);
  }

  private buildJobView(
    row: ExportJobRow,
    progress: { phase?: ExportPhase; processedRows?: number; totalRows?: number },
    filterSummary: string | undefined,
  ): ExportJobView {
    const view: ExportJobView = {
      id: row.id,
      entityType: row.entityType as ExportEntityType,
      format: row.format as ExportFormat,
      status: row.status as ExportStatus,
      progress: row.progress,
      filename: exportFilename(row.entityType, row.format as ExportFormat),
      createdAt: row.createdAt.toISOString(),
    };
    const processed = progress.processedRows ?? row.processedRows;
    const total = progress.totalRows ?? row.totalRows;
    const phase = progress.phase ?? row.phase;
    if (phase) view.phase = phase as ExportPhase;
    if (processed != null) view.processedRows = processed;
    if (total != null) view.totalRows = total;
    if (filterSummary) view.filterSummary = filterSummary;
    if (row.expiresAt) view.expiresAt = row.expiresAt.toISOString();
    if (row.errorMessage) view.errorMessage = row.errorMessage;
    if (row.completedAt) view.completedAt = row.completedAt.toISOString();
    return view;
  }
}
