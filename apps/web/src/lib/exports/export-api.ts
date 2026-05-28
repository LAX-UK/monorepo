import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { CreateExportRequest, CreateExportResponse, ExportJobView } from "@/lib/exports/types";

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? fallback;
}

export async function createExport(body: CreateExportRequest): Promise<CreateExportResponse> {
  const res = await browserFetch(`${browserApiBase()}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/csv" },
    body: JSON.stringify({ format: "csv", ...body }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errBody?.error ?? `Export failed (${res.status})`);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("text/csv")) {
    const blob = await res.blob();
    const filename = parseFilename(
      res.headers.get("Content-Disposition"),
      `${body.entityType}-export.csv`,
    );
    return { mode: "sync", blob, filename };
  }

  const json = (await res.json()) as { mode: "async" | "existing"; job: ExportJobView };
  return { mode: json.mode, job: json.job };
}

export async function previewExport(body: {
  entityType: CreateExportRequest["entityType"];
  filters?: Record<string, unknown>;
}): Promise<{ estimatedRows: number; syncMaxRows: number }> {
  const res = await browserFetch(`${browserApiBase()}/exports/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errBody?.error ?? `Export preview failed (${res.status})`);
  }
  return (await res.json()) as { estimatedRows: number; syncMaxRows: number };
}

export async function fetchExportJob(id: string): Promise<ExportJobView> {
  const res = await browserFetch(`${browserApiBase()}/exports/${id}`);
  if (!res.ok) throw new Error(`Could not load export status (${res.status})`);
  const json = (await res.json()) as { job: ExportJobView };
  return json.job;
}

export async function listExportJobs(): Promise<ExportJobView[]> {
  const res = await browserFetch(`${browserApiBase()}/exports`);
  if (!res.ok) throw new Error(`Could not load exports (${res.status})`);
  const json = (await res.json()) as { data: ExportJobView[] };
  return json.data;
}

export async function cancelExportJob(id: string): Promise<ExportJobView> {
  const res = await browserFetch(`${browserApiBase()}/exports/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not cancel export (${res.status})`);
  const json = (await res.json()) as { job: ExportJobView };
  return json.job;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function triggerExportDownload(id: string): void {
  window.open(`${browserApiBase()}/exports/${id}/download`, "_blank", "noopener,noreferrer");
}
