import type { ExportColumn, ExportFormat, ExportRow } from "./types.js";

const FORMULA_PREFIX = /^[=+\-@]/;

/** Escape CSV cell and neutralize spreadsheet formula injection. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatCsvHeader(columns: ExportColumn[]): string {
  return `${columns.map((c) => escapeCsvCell(c.header)).join(",")}\n`;
}

export function formatCsvRow(columns: ExportColumn[], row: ExportRow): string {
  return `${columns.map((c) => escapeCsvCell(row[c.key])).join(",")}\n`;
}

export function formatCsvDocument(columns: ExportColumn[], rows: ExportRow[]): string {
  return formatCsvHeader(columns) + rows.map((r) => formatCsvRow(columns, r).trimEnd()).join("\n");
}

export function exportFilename(entityType: string, format: ExportFormat = "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${entityType}-export-${date}.${format}`;
}
