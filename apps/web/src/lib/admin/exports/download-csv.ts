import { formatCsvDocument } from "@auction/exports";

/** Saves rows the page already holds as a CSV file in the browser. */
export function downloadCsv<K extends string>(
  filename: string,
  columns: readonly { key: K; header: string }[],
  rows: readonly Record<K, string>[],
): void {
  const csv = formatCsvDocument([...columns], [...rows]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
