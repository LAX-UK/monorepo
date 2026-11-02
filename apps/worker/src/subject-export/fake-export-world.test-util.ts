import { readFile } from "node:fs/promises";
import type {
  SubjectExportProduct,
  SubjectExportProgress,
  SubjectExportRecord,
} from "@auction/identity-contracts";
import { unzipSync } from "fflate";
import type { SubjectExportArchiveStore } from "./archive-store.js";
import { ClientPairAuth, IdentityBearerAuth } from "./export-request-auth.js";
import type { SubjectExportProgressPort } from "./identity-export-client.js";
import { HttpProductExportSource } from "./product-export-source.js";

export const SUBJECT_ID = "subject-1";
export const EXPORT_ID = "11111111-1111-4111-8111-111111111111";
export const BASE_URLS = {
  account: "https://identity.test",
  bid: "https://bid.test",
  shop: "https://shop.test",
} as const;
export const FILES_BASE = "https://files.test";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function record(id: string, extra: Record<string, unknown> = {}): SubjectExportRecord {
  return { id, origin: "provided", ...extra };
}

export function fileRef(name: string, bytes?: number | null) {
  return {
    url: `${FILES_BASE}/${encodeURIComponent(name)}`,
    fileName: name,
    contentType: "application/pdf",
    byteSize: bytes === undefined ? null : bytes,
    expiresAt: "2026-11-02T14:20:00.000Z",
  };
}

/**
 * One product's internal export routes, as an in-memory `fetch`. It checks the credential the way
 * the real routes do, pages with an offset cursor, and can be told to fail or hang.
 */
export class FakeProduct {
  readonly records = new Map<string, SubjectExportRecord[]>();
  readonly requests: string[] = [];
  /** Answers every route with this status. */
  failWith: number | null = null;
  hang = false;
  pageSize = 2;
  cursorLoop = false;
  tokenRequests = 0;
  private issued = 0;

  constructor(
    readonly product: SubjectExportProduct,
    readonly credential: "pair" | "bearer",
  ) {}

  /** Every token issued so far stops working, as if Identity had expired it. */
  rotateTokens(): void {
    this.issued += 1;
  }

  set(category: string, records: SubjectExportRecord[]): this {
    this.records.set(category, records);
    return this;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const request = new Request(input as string, init);
    const url = new URL(request.url);
    this.requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (this.hang) {
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(request.signal.reason));
      });
    }
    if (url.pathname === "/internal/oauth/token") return this.token(request);
    if (this.failWith !== null) return new Response("nope", { status: this.failWith });
    if (!this.authorised(request)) return new Response("no", { status: 401 });
    const prefix = `/internal/identity/subjects/${SUBJECT_ID}/export`;
    if (url.pathname === prefix) {
      return json({
        product: this.product,
        categories: [...this.records].map(([id, rows]) => ({
          id,
          schemaVersion: 1,
          count: rows.length,
        })),
      });
    }
    if (url.pathname.startsWith(`${prefix}/`)) {
      const rows = this.records.get(url.pathname.slice(prefix.length + 1));
      if (!rows) return json({ error: "unknown_export_category" }, 404);
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const next = offset + this.pageSize;
      return json({
        records: rows.slice(offset, next),
        nextCursor: this.cursorLoop ? "same" : next < rows.length ? String(next) : null,
      });
    }
    return new Response("not found", { status: 404 });
  };

  private token(request: Request): Response {
    this.tokenRequests += 1;
    this.issued += 1;
    const basic = `Basic ${Buffer.from("identity-client:identity-secret").toString("base64")}`;
    if (request.headers.get("authorization") !== basic)
      return json({ error: "invalid_client" }, 401);
    return json({ access_token: `token-${this.issued}`, token_type: "Bearer", expires_in: 300 });
  }

  private authorised(request: Request): boolean {
    if (this.credential === "bearer") {
      return request.headers.get("authorization") === `Bearer token-${this.issued}`;
    }
    return (
      request.headers.get("x-identity-client-id") === "export-client" &&
      request.headers.get("x-identity-client-secret") === "export-secret" &&
      request.headers.get("x-identity-client-scope") === "subject_export"
    );
  }

  source(): HttpProductExportSource {
    return new HttpProductExportSource({
      product: this.product,
      baseUrl: BASE_URLS[this.product],
      auth:
        this.credential === "bearer"
          ? new IdentityBearerAuth({
              baseUrl: BASE_URLS[this.product],
              clientId: "identity-client",
              clientSecret: "identity-secret",
              fetchImpl: this.fetch,
            })
          : new ClientPairAuth("export-client", "export-secret"),
      fetchImpl: this.fetch,
      requestTimeoutMs: 1_000,
    });
  }
}

/** The files a product serves from its own storage, as signed links would. */
export class FakeFileHost {
  readonly files = new Map<string, Uint8Array>();
  readonly requested: string[] = [];
  failWith: number | null = null;

  put(name: string, bytes: Uint8Array): this {
    this.files.set(`/${encodeURIComponent(name)}`, bytes);
    return this;
  }

  readonly fetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : (input as Request).url);
    this.requested.push(url.pathname);
    if (this.failWith !== null) return new Response("no", { status: this.failWith });
    const body = this.files.get(url.pathname);
    return body ? new Response(body) : new Response("gone", { status: 404 });
  };
}

export class FakeProgress implements SubjectExportProgressPort {
  readonly reports: SubjectExportProgress[] = [];
  failWith: Error | null = null;

  async report(_exportId: string, progress: SubjectExportProgress): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.reports.push(progress);
  }
}

export class FakeArchiveStore implements SubjectExportArchiveStore {
  readonly objects = new Map<string, Buffer>();
  readonly deleted: string[] = [];
  failUpload: Error | null = null;
  failDelete = new Set<string>();

  async uploadFile(key: string, filePath: string): Promise<void> {
    if (this.failUpload) throw this.failUpload;
    this.objects.set(key, await readFile(filePath));
  }

  async deleteObject(key: string): Promise<void> {
    if (this.failDelete.has(key)) throw new Error("storage down");
    this.deleted.push(key);
    this.objects.delete(key);
  }
}

/** The ZIP as a map of path to bytes. */
export function unzip(archive: Buffer): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(archive));
}

export const text = (bytes: Uint8Array | undefined): string =>
  bytes ? new TextDecoder().decode(bytes) : "";
