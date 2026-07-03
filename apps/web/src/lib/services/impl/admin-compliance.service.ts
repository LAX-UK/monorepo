import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type {
  AdminComplianceBulkDownload,
  AdminComplianceDocumentDownload,
  IAdminComplianceService,
} from "../interfaces/admin-compliance-service";

function sofPath(caseId: string, suffix: string): string {
  return `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/${suffix}`;
}

function readDownloadUrl(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const url = (body as { data?: { url?: unknown } }).data?.url;
  return typeof url === "string" ? url : null;
}

export class AdminComplianceService implements IAdminComplianceService {
  constructor(private readonly api: IAuthedApiClient) {}

  amlTriage(screeningId: string, recommendation: "clear" | "block", notes?: string) {
    return this.api.json<unknown>(
      `/admin/compliance/aml/screenings/${encodeURIComponent(screeningId)}/triage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation, notes: notes || undefined }),
      },
    );
  }

  amlDecide(screeningId: string, decision: "clear" | "block", notes?: string) {
    return this.api.json<unknown>(
      `/admin/compliance/aml/screenings/${encodeURIComponent(screeningId)}/decide`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes || undefined }),
      },
    );
  }

  sofTriage(caseId: string, recommendation: "approve" | "reject", notes?: string) {
    return this.api.json<unknown>(sofPath(caseId, "triage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation, notes: notes || undefined }),
    });
  }

  sofDecide(caseId: string, decision: "approve" | "reject", notes?: string) {
    return this.api.json<unknown>(sofPath(caseId, "decide"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes: notes || undefined }),
    });
  }

  sofReopen(caseId: string) {
    return this.api.json<unknown>(sofPath(caseId, "reopen"), { method: "POST" });
  }

  async downloadSofDocument(
    caseId: string,
    documentId: string,
  ): Promise<ServiceResult<AdminComplianceDocumentDownload>> {
    const r = await this.api.json<unknown>(
      sofPath(caseId, `documents/${encodeURIComponent(documentId)}/download`),
    );
    if (!r.ok) return r;
    const url = readDownloadUrl(r.data);
    if (!url) {
      return serviceFailure("Download URL unavailable", r.status, r.data);
    }
    return serviceSuccess({ url }, r.status);
  }

  async downloadAllSofDocuments(
    caseId: string,
  ): Promise<ServiceResult<AdminComplianceBulkDownload>> {
    const res = await this.api.request(sofPath(caseId, "documents/download-all"));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return serviceFailure("Download failed", res.status, body);
    }
    const buffer = await res.arrayBuffer();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] ?? `source-of-funds-${caseId}.zip`;
    return serviceSuccess({ data: buffer, fileName }, res.status);
  }

  requestSofDocuments(caseId: string, documentTypes: string[], note?: string) {
    return this.api.json<unknown>(sofPath(caseId, "request-documents"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentTypes, note: note || undefined }),
    });
  }

  reviewSofDocument(
    caseId: string,
    documentId: string,
    checks: {
      matchesDeclaredSource?: boolean;
      coversExposure?: boolean;
      recentEnough?: boolean;
      legibleComplete?: boolean;
    },
    note?: string,
  ) {
    return this.api.json<unknown>(
      sofPath(caseId, `documents/${encodeURIComponent(documentId)}/review`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks, note: note?.trim() || undefined }),
      },
    );
  }
}
