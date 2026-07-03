import type { dataExport } from "@auction/db/schema";

export type ExportJobRow = typeof dataExport.$inferSelect;
