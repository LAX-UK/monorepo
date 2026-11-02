import {
  SUBJECT_EXPORT_MAX_PAGE_BYTES,
  type SubjectExportManifest,
  type SubjectExportPage,
  type SubjectExportProduct,
  subjectExportManifestPath,
  subjectExportManifestSchema,
  subjectExportPagePath,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import type { ExportRequestAuth } from "./export-request-auth.js";
import {
  SubjectExportError,
  kindForStatus,
  permanentError,
  transientError,
} from "./subject-export.errors.js";

/** What the job needs from one product: its manifest, then its categories page by page. */
export interface ProductExportSource {
  manifest(subjectId: string, signal: AbortSignal): Promise<SubjectExportManifest>;
  page(
    subjectId: string,
    categoryId: string,
    cursor: string | null,
    signal: AbortSignal,
  ): Promise<SubjectExportPage>;
}

export type HttpProductExportSourceConfig = {
  product: SubjectExportProduct;
  baseUrl: string;
  auth: ExportRequestAuth;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
/** A page may be 1 MB on the wire; this leaves room for the envelope, not for a runaway answer. */
const MAX_RESPONSE_BYTES = SUBJECT_EXPORT_MAX_PAGE_BYTES * 2;

/**
 * A product's internal export routes over HTTP. Every answer is validated against the shared
 * contract. A refused credential is retried once with a fresh one, so an expired token is not a
 * failure.
 */
export class HttpProductExportSource implements ProductExportSource {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: HttpProductExportSourceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  async manifest(subjectId: string, signal: AbortSignal): Promise<SubjectExportManifest> {
    const body = await this.get(subjectExportManifestPath(subjectId), signal);
    const parsed = subjectExportManifestSchema.safeParse(body);
    if (!parsed.success || parsed.data.product !== this.config.product) {
      throw permanentError("invalid_product_response", this.config.product);
    }
    return parsed.data;
  }

  async page(
    subjectId: string,
    categoryId: string,
    cursor: string | null,
    signal: AbortSignal,
  ): Promise<SubjectExportPage> {
    const body = await this.get(subjectExportPagePath(subjectId, categoryId, cursor), signal);
    const parsed = subjectExportPageSchema.safeParse(body);
    if (!parsed.success) throw permanentError("invalid_product_response", this.config.product);
    return parsed.data;
  }

  private async get(path: string, signal: AbortSignal): Promise<unknown> {
    const first = await this.attempt(path, signal);
    if (first.status !== 401) return this.read(first);
    this.config.auth.rejected();
    return this.read(await this.attempt(path, signal));
  }

  private async attempt(path: string, signal: AbortSignal): Promise<Response> {
    const { product } = this.config;
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { accept: "application/json", ...(await this.config.auth.headers(signal)) },
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      });
    } catch (error) {
      if (error instanceof SubjectExportError) throw error;
      throw transientError("product_unreachable", product, error);
    }
  }

  private async read(response: Response): Promise<unknown> {
    const { product } = this.config;
    if (!response.ok) {
      // The body is not read: an error answer is never worth keeping, and it could echo input.
      await response.body?.cancel().catch(() => undefined);
      throw new SubjectExportError(
        kindForStatus(response.status),
        `product_http_${response.status}`,
        product,
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw transientError("product_unreachable", product, error);
    }
    if (text.length > MAX_RESPONSE_BYTES)
      throw permanentError("product_response_too_large", product);
    try {
      return JSON.parse(text);
    } catch {
      throw permanentError("invalid_product_response", product);
    }
  }
}
