import { createHash, timingSafeEqual } from "node:crypto";
import {
  DATA_REQUESTS_ROUTE,
  type DataRequestError,
  closeDataRequestSchema,
  continueDataRequestSchema,
  createDataRequestSchema,
  dataRequestListQuerySchema,
  dataRequestRecordQuerySchema,
  extendDataRequestSchema,
  patchDataRequestSchema,
} from "@auction/identity-contracts";
import type { Context, Hono } from "hono";
import { InvalidDataRequestCursorError } from "../services/data-request.cursor.js";
import type { DataRequestResult, DataRequestService } from "../services/data-request.service.js";

/** The staff credential for the data request routes. It is neither the lifecycle nor the export credential. */
export type DataRequestsMachineDeps = {
  requests: Pick<
    DataRequestService,
    "list" | "summary" | "record" | "create" | "patch" | "extend" | "close" | "continueDownload"
  >;
  /** Tokens issued for the `data_requests.staff` scope are stored and looked up under their own key. */
  redis: { get(key: string): Promise<string | null> };
  clientId: string;
  clientSecret: string;
  /** Seconds to wait when the credential is over its budget, otherwise null. */
  rateLimit(): Promise<number | null>;
  onFailure?: (error: unknown) => void;
};

/** Where a data-requests token lives; no other route looks here, and these routes look nowhere else. */
export function dataRequestsTokenKey(token: string): string {
  return `identity:data-requests-token:${createHash("sha256").update(token).digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

/**
 * How each refusal reaches the caller. A missing request is 404 and a request about the actor
 * is 403; a change made against an out-of-date copy, or that repeats a one-off, is 409; every
 * other broken rule is 422. A new refusal defaults to 422 until it is listed.
 */
const STATUS_BY_ERROR: Partial<Record<DataRequestError, 403 | 404 | 409>> = {
  not_found: 404,
  own_request: 403,
  stale_version: 409,
  already_closed: 409,
  already_extended: 409,
  already_continued: 409,
  ambiguous_reference: 409,
};

/**
 * Staff's data request routes. Mounted before the lifecycle routes' own authentication, so they
 * accept only a token issued for the `data_requests.staff` scope. Every response is uncacheable:
 * the record pages carry a person's details.
 */
export function mountDataRequestsMachineRoutes(app: Hono, deps: DataRequestsMachineDeps): void {
  const base = DATA_REQUESTS_ROUTE;

  async function guard(c: Context) {
    c.header("Cache-Control", "no-store");
    const authorization = c.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const clientId = token ? await deps.redis.get(dataRequestsTokenKey(token)) : null;
    if (clientId === null || !safeEqual(clientId, deps.clientId)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const retryAfterSec = await deps.rateLimit();
    if (retryAfterSec !== null) {
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "rate_limited" }, 429);
    }
    return null;
  }

  /** Runs one route under the guard, turning a failure into 503 and a refusal into its status. */
  async function handle(c: Context, run: () => Promise<Response>) {
    const refused = await guard(c);
    if (refused) return refused;
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidDataRequestCursorError) {
        return c.json({ error: "invalid_cursor" }, 400);
      }
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  }

  function answer<T>(c: Context, result: DataRequestResult<T>, status: 200 | 201 = 200) {
    if (result.ok) return c.json(result.value, status);
    return c.json({ error: result.error }, STATUS_BY_ERROR[result.error] ?? 422);
  }

  async function body(c: Context): Promise<unknown> {
    return c.req.json().catch(() => null);
  }

  const invalid = (c: Context) => c.json({ error: "invalid_request" }, 400);
  const referenceOf = (c: Context) => (c.req.param("reference") ?? "").toUpperCase();

  app.get(base, (c) =>
    handle(c, async () => {
      const query = dataRequestListQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
      );
      if (!query.success) return invalid(c);
      return c.json(await deps.requests.list(query.data));
    }),
  );

  app.get(`${base}/summary`, (c) => handle(c, async () => c.json(await deps.requests.summary())));

  app.get(`${base}/:reference`, (c) =>
    handle(c, async () => {
      const query = dataRequestRecordQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
      );
      if (!query.success) return invalid(c);
      return answer(c, await deps.requests.record(referenceOf(c), query.data.actorSubjectId));
    }),
  );

  app.post(base, (c) =>
    handle(c, async () => {
      const input = createDataRequestSchema.safeParse(await body(c));
      if (!input.success) return invalid(c);
      return answer(c, await deps.requests.create(input.data), 201);
    }),
  );

  app.patch(`${base}/:reference`, (c) =>
    handle(c, async () => {
      const input = patchDataRequestSchema.safeParse(await body(c));
      if (!input.success) return invalid(c);
      return answer(c, await deps.requests.patch(referenceOf(c), input.data));
    }),
  );

  app.post(`${base}/:reference/extend`, (c) =>
    handle(c, async () => {
      const input = extendDataRequestSchema.safeParse(await body(c));
      if (!input.success) return invalid(c);
      return answer(c, await deps.requests.extend(referenceOf(c), input.data));
    }),
  );

  app.post(`${base}/:reference/close`, (c) =>
    handle(c, async () => {
      const input = closeDataRequestSchema.safeParse(await body(c));
      if (!input.success) return invalid(c);
      return answer(c, await deps.requests.close(referenceOf(c), input.data));
    }),
  );

  app.post(`${base}/:reference/continue`, (c) =>
    handle(c, async () => {
      const input = continueDataRequestSchema.safeParse(await body(c));
      if (!input.success) return invalid(c);
      return answer(
        c,
        await deps.requests.continueDownload(referenceOf(c), input.data.actorSubjectId),
        201,
      );
    }),
  );
}
