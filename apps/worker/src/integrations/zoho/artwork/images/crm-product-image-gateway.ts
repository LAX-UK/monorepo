import type { WorkerEnv } from "../../../../env.js";
import { getZohoCrmAccessToken, invalidateZohoCrmAccessToken } from "../../oauth-token-refresh.js";
import { ZohoCrmAuthError } from "../../types.js";
import { looksLikeImageFile } from "./validate-image.js";
import {
  type RemoteProductImage,
  ZohoImageFetchError,
  type ZohoProductImageGateway,
} from "./zoho-product-image.js";

const RECORD_IMAGE_ID = "record_image";
const ATTACHMENT_FIELDS = "id,File_Name,Size,Modified_Time,Created_Time";
const ATTACHMENT_PAGE_SIZE = 200;
const MAX_ATTACHMENT_PAGES = 5;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
const MIN_INTERVAL_MS = 100;
/** Statuses where trying again later may work; every other failure status is final for the file. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type CrmProductImageGatewayOptions = {
  apiHost: string;
  /** Replaceable for tests. */
  sleep?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
};

type AttachmentRow = {
  id?: unknown;
  File_Name?: unknown;
  Size?: unknown;
  Modified_Time?: unknown;
  Created_Time?: unknown;
};

/**
 * Reads a Product's pictures from Zoho CRM with the worker's existing Zoho credentials: the
 * Product's own image (the "Artwork Image" field) first, then image attachments in the order they
 * were added. Calls are spaced and retried on rate limits and server errors, honouring
 * `Retry-After`, like the rest of the Zoho gateway.
 */
export class CrmProductImageGateway implements ZohoProductImageGateway {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchFn: typeof fetch;
  private lastCallMs = 0;

  constructor(
    private readonly env: WorkerEnv,
    private readonly options: CrmProductImageGatewayOptions,
  ) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async listImages(productId: string): Promise<RemoteProductImage[]> {
    const id = encodeURIComponent(productId);
    const images: RemoteProductImage[] = [];

    const record = await this.getJson(`/crm/v8/Products/${id}?fields=Record_Image`);
    const recordImage = readRecordImage(record);
    if (recordImage) {
      images.push({
        fileId: RECORD_IMAGE_ID,
        fingerprint: recordImage,
        origin: "record_image",
        fileName: null,
      });
    }

    const attachments: AttachmentRow[] = [];
    for (let page = 1; page <= MAX_ATTACHMENT_PAGES; page++) {
      const body = await this.getJson(
        `/crm/v8/Products/${id}/Attachments?fields=${ATTACHMENT_FIELDS}&per_page=${ATTACHMENT_PAGE_SIZE}&page=${page}`,
      );
      attachments.push(...readRows(body));
      if (!hasMore(body)) break;
    }
    images.push(...toAttachmentImages(attachments));
    return images;
  }

  async downloadImage(
    productId: string,
    image: RemoteProductImage,
    maxBytes: number,
  ): Promise<Buffer> {
    const id = encodeURIComponent(productId);
    const path =
      image.origin === "record_image"
        ? `/crm/v8/Products/${id}/photo`
        : `/crm/v8/Products/${id}/Attachments/${encodeURIComponent(image.fileId)}`;
    const response = await this.send(path, "*/*");
    if (response.status === 204) throw new ZohoImageFetchError("not_found", false);
    if (!response.ok) throw failureFor(response.status);

    const declared = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel();
      throw new ZohoImageFetchError("too_large", false);
    }
    return readCapped(response, maxBytes);
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.send(path, "application/json");
    if (response.status === 204) return null;
    if (!response.ok) throw failureFor(response.status);
    try {
      return await response.json();
    } catch {
      throw new ZohoImageFetchError("unavailable", true, "zoho_images_invalid_json");
    }
  }

  /** One authenticated GET with spacing, one token refresh on 401 and bounded retries. */
  private async send(path: string, accept: string): Promise<Response> {
    let authRetried = false;
    for (let attempt = 1; ; attempt++) {
      const wait = this.lastCallMs + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.lastCallMs = Date.now();

      const token = await getZohoCrmAccessToken(this.env);
      if (!token) throw new ZohoCrmAuthError("zoho_crm_not_configured");

      let response: Response | null = null;
      try {
        response = await this.fetchFn(new URL(path, this.options.apiHost), {
          headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: accept },
        });
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS) {
          throw new ZohoImageFetchError("unavailable", true, errorText(error));
        }
        await this.sleep(backoff(attempt));
        continue;
      }

      if (response.status === 401 && !authRetried) {
        authRetried = true;
        invalidateZohoCrmAccessToken();
        await response.body?.cancel();
        attempt -= 1;
        continue;
      }
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
        const retryAfter = retryAfterMs(response);
        await response.body?.cancel();
        await this.sleep(retryAfter ?? backoff(attempt));
        continue;
      }
      return response;
    }
  }
}

function backoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_BACKOFF_MS * 3)
    : undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "zoho_images_network_error";
}

function failureFor(status: number): ZohoImageFetchError {
  return RETRYABLE_STATUSES.has(status) || status === 401
    ? new ZohoImageFetchError("unavailable", true, `zoho_images_http_${status}`)
    : new ZohoImageFetchError("not_found", false, `zoho_images_http_${status}`);
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ZohoImageFetchError("too_large", false);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function readRecordImage(body: unknown): string | null {
  const row = readRows(body)[0] as { Record_Image?: unknown } | undefined;
  const value = row?.Record_Image;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readRows(body: unknown): AttachmentRow[] {
  if (typeof body !== "object" || body === null) return [];
  const data = (body as { data?: unknown }).data;
  return Array.isArray(data)
    ? data.filter((row): row is AttachmentRow => typeof row === "object" && row !== null)
    : [];
}

function hasMore(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  return (body as { info?: { more_records?: unknown } }).info?.more_records === true;
}

function text(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Image attachments, oldest first (Zoho's own order of adding), then by id. */
function toAttachmentImages(rows: readonly AttachmentRow[]): RemoteProductImage[] {
  return rows
    .flatMap((row) => {
      const fileId = text(row.id);
      const fileName = text(row.File_Name);
      if (!fileId || !looksLikeImageFile(fileName)) return [];
      const created = text(row.Created_Time) ?? "";
      const fingerprint = `${text(row.Size) ?? ""}:${text(row.Modified_Time) ?? created}`;
      return [{ fileId, fileName, created, fingerprint }];
    })
    .sort((a, b) => a.created.localeCompare(b.created) || compareIds(a.fileId, b.fileId))
    .map(
      ({ fileId, fileName, fingerprint }): RemoteProductImage => ({
        fileId,
        fingerprint,
        origin: "attachment",
        fileName,
      }),
    );
}

function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
