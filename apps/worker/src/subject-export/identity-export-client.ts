import {
  type SubjectExportProgress,
  type SubjectExportPurgePending,
  subjectExportProgressPath,
  subjectExportPurgePendingPath,
  subjectExportPurgePendingSchema,
  subjectExportPurgedPath,
} from "@auction/identity-contracts";
import type { ExportRequestAuth } from "./export-request-auth.js";
import {
  SubjectExportError,
  kindForStatus,
  permanentError,
  transientError,
} from "./subject-export.errors.js";

/** Tells Identity how a request is going. Identity owns the request; this is the only way to change it. */
export interface SubjectExportProgressPort {
  report(exportId: string, progress: SubjectExportProgress): Promise<void>;
}

/** The stored copies Identity wants deleted, and the way to say one is gone. */
export interface SubjectExportPurgePort {
  pending(limit: number): Promise<SubjectExportPurgePending["items"]>;
  confirmPurged(exportId: string): Promise<void>;
}

export type IdentityExportClientConfig = {
  baseUrl: string;
  auth: ExportRequestAuth;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Identity's worker-facing routes over HTTP, with the `subject_export` bearer. A repeated report
 * answers "ignored", which counts as success: reports apply once. Nothing else reads Identity's
 * database for this.
 */
export class HttpIdentityExportClient implements SubjectExportProgressPort, SubjectExportPurgePort {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: IdentityExportClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async report(exportId: string, progress: SubjectExportProgress): Promise<void> {
    try {
      await this.send("POST", subjectExportProgressPath(exportId), progress);
    } catch (error) {
      // Identity has no such request: another attempt would get the same answer.
      if (error instanceof SubjectExportError && error.code === "identity_http_404") {
        throw permanentError("export_request_not_found");
      }
      throw error;
    }
  }

  async pending(limit: number): Promise<SubjectExportPurgePending["items"]> {
    const body = await this.send("GET", subjectExportPurgePendingPath(limit));
    const parsed = subjectExportPurgePendingSchema.safeParse(body);
    if (!parsed.success) throw new SubjectExportError("permanent", "invalid_identity_response");
    return parsed.data.items;
  }

  async confirmPurged(exportId: string): Promise<void> {
    await this.send("POST", subjectExportPurgedPath(exportId));
  }

  private async send(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let response = await this.attempt(method, path, body);
    if (response.status === 401) {
      this.config.auth.rejected();
      response = await this.attempt(method, path, body);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new SubjectExportError(
        kindForStatus(response.status),
        `identity_http_${response.status}`,
      );
    }
    return response.json().catch(() => ({}));
  }

  private async attempt(method: string, path: string, body: unknown): Promise<Response> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(await this.config.auth.headers(signal)),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
      });
    } catch (error) {
      if (error instanceof SubjectExportError) throw error;
      throw transientError("identity_unreachable", undefined, error);
    }
  }
}
