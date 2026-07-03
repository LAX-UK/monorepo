import { Readable } from "node:stream";
import { formatCsvHeader, formatCsvRow } from "@auction/exports";
import type { ExportProvider } from "../../exports/types.js";
import type { IExportJobRepository } from "../../repositories/interfaces/export-job.repository.js";
import type { ExportAuthContext } from "./export-types.js";

export class SyncExportRunner {
  constructor(private readonly repo: IExportJobRepository) {}

  createCsvStream(input: {
    provider: ExportProvider;
    ctx: ExportAuthContext;
    filters: Record<string, unknown>;
    exportId: string;
    totalRows: number;
    onFailed: (exportId: string, message: string) => Promise<void>;
  }): Readable {
    const columns = input.provider.columns(input.ctx, input.filters);
    return Readable.from(
      this.syncCsvGenerator({
        ...input,
        columns,
      }),
    );
  }

  private async *syncCsvGenerator(input: {
    provider: ExportProvider;
    ctx: ExportAuthContext;
    filters: Record<string, unknown>;
    columns: ReturnType<ExportProvider["columns"]>;
    exportId: string;
    totalRows: number;
    onFailed: (exportId: string, message: string) => Promise<void>;
  }): AsyncGenerator<string> {
    try {
      yield formatCsvHeader(input.columns);
      let processedRows = 0;
      for await (const row of input.provider.streamRows(input.ctx, input.filters)) {
        yield formatCsvRow(input.columns, row);
        processedRows += 1;
        if (processedRows % 500 === 0 && input.totalRows > 0) {
          await this.repo.updateProgress(input.exportId, {
            processedRows,
            progress: Math.min(99, Math.round((processedRows / input.totalRows) * 100)),
          });
        }
      }
      await this.repo.updateProgress(input.exportId, {
        status: "completed",
        phase: null,
        progress: 100,
        processedRows,
        completedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      await input.onFailed(input.exportId, message);
      throw err;
    }
  }
}
