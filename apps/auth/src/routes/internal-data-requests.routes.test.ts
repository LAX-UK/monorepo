import type { DataRequestRecord } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { InvalidDataRequestCursorError } from "../services/data-request.cursor.js";
import type { DataRequestResult } from "../services/data-request.service.js";
import { createInternalIdentityRoutes } from "./internal-identity.routes.js";

const LIFECYCLE_BASIC = Buffer.from("api-service:machine-secret-at-least-32-characters").toString(
  "base64",
);
const EXPORT_BASIC = Buffer.from(
  "subject-export-worker:export-secret-at-least-32-characters",
).toString("base64");
const REQUESTS_BASIC = Buffer.from(
  "bid-data-requests:requests-secret-at-least-32-characters",
).toString("base64");

const RECORD = { request: { reference: "DR-0001" } } as unknown as DataRequestRecord;
const ok = async (): Promise<DataRequestResult<DataRequestRecord>> => ({ ok: true, value: RECORD });

function setup(options: { limit?: number | null; withRequests?: boolean } = {}) {
  const store = new Map<string, string>();
  const requests = {
    list: vi.fn(async (_query: unknown) => ({ items: [], nextCursor: null })),
    summary: vi.fn(async () => ({
      open: 1,
      dueSoon: 0,
      overdue: 0,
      waitingForId: 0,
      answeredLast12Months: { answered: 0, onTime: 0 },
    })),
    record: vi.fn(ok),
    create: vi.fn(ok),
    patch: vi.fn(ok),
    extend: vi.fn(ok),
    close: vi.fn(ok),
    continueDownload: vi.fn(ok),
  };
  const app = createInternalIdentityRoutes({
    lifecycle: { disable: vi.fn(), enable: vi.fn(), merge: vi.fn() } as never,
    operations: {} as never,
    emailChange: {} as never,
    accountDeletion: {} as never,
    redis: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
      },
      del: async (key) => {
        store.delete(key);
      },
      incr: async (key) => {
        const next = Number(store.get(key) ?? 0) + 1;
        store.set(key, String(next));
        return next;
      },
      expire: async () => 1,
      ttl: async () => 60,
    },
    machineClientId: "api-service",
    machineClientSecret: "machine-secret-at-least-32-characters",
    subjectExport: {
      exports: {} as never,
      reader: {} as never,
      redis: { get: async (key: string) => store.get(key) ?? null },
      clientId: "subject-export-worker",
      clientSecret: "export-secret-at-least-32-characters",
      rateLimit: async () => null,
      readRateLimit: async () => null,
    },
    ...(options.withRequests === false
      ? {}
      : {
          dataRequests: {
            requests,
            redis: { get: async (key: string) => store.get(key) ?? null },
            clientId: "bid-data-requests",
            clientSecret: "requests-secret-at-least-32-characters",
            rateLimit: async () => options.limit ?? null,
          },
        }),
  });
  const token = async (basic: string, scope: string) =>
    app.request("/oauth/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&scope=${scope}`,
    });
  const issue = async (basic: string, scope: string) =>
    ((await (await token(basic, scope)).json()) as { access_token: string }).access_token;
  const call = (bearer: string | null, method: string, path: string, body?: unknown) =>
    app.request(`/identity/data-requests${path}`, {
      method,
      headers: {
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { app, requests, token, issue, call };
}

const STAFF = { actorSubjectId: "staff_1" };

describe("data requests credential", () => {
  it("issues a token for its own scope and client only", async () => {
    const { token } = setup();
    const issued = await token(REQUESTS_BASIC, "data_requests.staff");
    expect(issued.status).toBe(200);
    expect(await issued.json()).toMatchObject({ scope: "data_requests.staff" });
    // The wrong client for the scope, and the right client asking for another scope.
    expect((await token(LIFECYCLE_BASIC, "data_requests.staff")).status).toBe(401);
    expect((await token(EXPORT_BASIC, "data_requests.staff")).status).toBe(401);
    expect((await token(REQUESTS_BASIC, "identity.lifecycle")).status).toBe(401);
    expect((await token(REQUESTS_BASIC, "subject_export")).status).toBe(401);
  });

  it("is not offered when it is not configured", async () => {
    const { token } = setup({ withRequests: false });
    expect((await token(REQUESTS_BASIC, "data_requests.staff")).status).toBe(401);
  });

  it("is the only token these routes accept", async () => {
    const { issue, call, requests } = setup();
    const lifecycle = await issue(LIFECYCLE_BASIC, "identity.lifecycle");
    const exporter = await issue(EXPORT_BASIC, "subject_export");
    for (const bearer of [null, "made-up", lifecycle, exporter]) {
      expect((await call(bearer, "GET", "")).status).toBe(401);
      expect((await call(bearer, "GET", "/summary")).status).toBe(401);
      expect((await call(bearer, "GET", "/DR-0001?actorSubjectId=staff_1")).status).toBe(401);
      expect((await call(bearer, "POST", "", {})).status).toBe(401);
      expect((await call(bearer, "POST", "/DR-0001/close", {})).status).toBe(401);
    }
    expect(requests.list).not.toHaveBeenCalled();
    expect(requests.close).not.toHaveBeenCalled();
  });

  it("does not open the lifecycle or export routes to its own token", async () => {
    const { issue, app } = setup();
    const staff = await issue(REQUESTS_BASIC, "data_requests.staff");
    const lifecycle = await app.request("/identity/subjects/person-1", {
      headers: { authorization: `Bearer ${staff}` },
    });
    expect(lifecycle.status).toBe(401);
    const exporter = await app.request("/identity/subject-exports/purge-pending", {
      headers: { authorization: `Bearer ${staff}` },
    });
    expect(exporter.status).toBe(401);
  });

  it("answers 429 with Retry-After when over its budget, and never caches", async () => {
    const { issue, call } = setup({ limit: 12 });
    const staff = await issue(REQUESTS_BASIC, "data_requests.staff");
    const response = await call(staff, "GET", "/summary");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("data requests routes", () => {
  async function staff() {
    const harness = setup();
    return { ...harness, bearer: await harness.issue(REQUESTS_BASIC, "data_requests.staff") };
  }

  it("lists with parsed filters and never caches", async () => {
    const { bearer, call, requests } = await staff();
    const response = await call(
      bearer,
      "GET",
      "?view=overdue&product=bid&sort=requested&q=lena%40north.com",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(requests.list).toHaveBeenCalledWith({
      view: "overdue",
      product: "bid",
      sort: "requested",
      q: "lena@north.com",
    });
  });

  it("defaults the list to Open by due date and refuses unknown filters", async () => {
    const { bearer, call, requests } = await staff();
    await call(bearer, "GET", "");
    expect(requests.list).toHaveBeenCalledWith({ view: "open", sort: "due" });
    expect((await call(bearer, "GET", "?view=everything")).status).toBe(400);
    expect((await call(bearer, "GET", "?product=lax")).status).toBe(400);
  });

  it("refuses a bad cursor with 400", async () => {
    const { bearer, call, requests } = await staff();
    requests.list.mockRejectedValueOnce(new InvalidDataRequestCursorError());
    const response = await call(bearer, "GET", "?cursor=zzz");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_cursor" });
  });

  it("answers the summary", async () => {
    const { bearer, call } = await staff();
    expect(await (await call(bearer, "GET", "/summary")).json()).toMatchObject({ open: 1 });
  });

  it("opens a record for the acting staff member, upper-casing the reference", async () => {
    const { bearer, call, requests } = await staff();
    const response = await call(bearer, "GET", "/dr-0001?actorSubjectId=staff_1");
    expect(response.status).toBe(200);
    expect(requests.record).toHaveBeenCalledWith("DR-0001", "staff_1");
    expect((await call(bearer, "GET", "/DR-0001")).status).toBe(400);
  });

  it("logs, edits, extends, closes and continues with the staff id", async () => {
    const { bearer, call, requests } = await staff();
    const created = await call(bearer, "POST", "", {
      ...STAFF,
      person: { kind: "account", subjectId: "user_1" },
      reason: "full_copy",
      channel: "email",
      receivedOn: "2026-11-02",
      identity: "confirmed",
      products: ["account"],
    });
    expect(created.status).toBe(201);
    expect(
      (await call(bearer, "PATCH", "/DR-0001", { ...STAFF, version: 1, notes: "Called" })).status,
    ).toBe(200);
    expect(
      (
        await call(bearer, "POST", "/DR-0001/extend", {
          ...STAFF,
          version: 1,
          months: 1,
          reason: "complex",
          note: "Archive",
          personToldOn: "2026-11-10",
          personToldVia: "email",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call(bearer, "POST", "/DR-0001/close", { ...STAFF, version: 1, outcome: "sent" }))
        .status,
    ).toBe(200);
    expect((await call(bearer, "POST", "/DL-7F3C1A/continue", STAFF)).status).toBe(201);
    expect(requests.continueDownload).toHaveBeenCalledWith("DL-7F3C1A", "staff_1");
  });

  it("refuses a body that breaks the contract before it reaches a rule", async () => {
    const { bearer, call, requests } = await staff();
    expect(
      (await call(bearer, "POST", "/DR-0001/close", { ...STAFF, version: 1, outcome: "refused" }))
        .status,
    ).toBe(400);
    expect(
      (await call(bearer, "POST", "/DR-0001/extend", { ...STAFF, version: 1, months: 3 })).status,
    ).toBe(400);
    expect((await call(bearer, "POST", "", { person: {} })).status).toBe(400);
    expect(requests.close).not.toHaveBeenCalled();
    expect(requests.extend).not.toHaveBeenCalled();
    expect(requests.create).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["own_request", 403],
    ["stale_version", 409],
    ["already_extended", 409],
    ["already_continued", 409],
    ["ambiguous_reference", 409],
    ["extension_after_due_date", 422],
    ["person_told_after_due_date", 422],
    ["complaint_right_required", 422],
    ["continue_not_allowed", 422],
  ] as const)("answers a refusal %s with %i", async (error, status) => {
    const { bearer, call, requests } = await staff();
    requests.close.mockResolvedValueOnce({ ok: false, error });
    const response = await call(bearer, "POST", "/DR-0001/close", {
      ...STAFF,
      version: 1,
      outcome: "sent",
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("answers 503 without leaking the failure", async () => {
    const { bearer, call, requests } = await staff();
    requests.summary.mockRejectedValueOnce(new Error("connection refused"));
    const response = await call(bearer, "GET", "/summary");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
  });
});
