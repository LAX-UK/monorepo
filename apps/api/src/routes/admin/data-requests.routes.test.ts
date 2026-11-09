import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { DataRequestsUnavailableError } from "../../services/interfaces/identity-data-requests-client.js";
import { attachAdminDataRequestsRoutes } from "./data-requests.routes.js";

const RECORD = { request: { reference: "DR-0001" }, person: { name: "Lena Fischer" } };
const ok = { ok: true, value: RECORD };

function createApp(staffRoles: StaffRoles | undefined) {
  const dataRequests = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    summary: vi.fn().mockResolvedValue({ open: 1 }),
    findAccount: vi.fn().mockResolvedValue({ subjectId: "user_1", name: "Lena", status: "active" }),
    record: vi.fn().mockResolvedValue(ok),
    create: vi.fn().mockResolvedValue(ok),
    patch: vi.fn().mockResolvedValue(ok),
    extend: vi.fn().mockResolvedValue(ok),
    close: vi.fn().mockResolvedValue(ok),
    continueDownload: vi.fn().mockResolvedValue(ok),
    eraseEnquiries: vi.fn().mockResolvedValue({ ok: true, value: { enquiries: 2, held: 1 } }),
    dealHolds: vi.fn().mockResolvedValue({ ok: true, value: { holds: [] } }),
  };
  const container = { env: { LOG_LEVEL: "silent", NODE_ENV: "test" }, admin: { dataRequests } };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminDataRequestsRoutes(app as never, container as never);
  return { app, dataRequests };
}

const send = (method: string, body?: unknown) => ({
  method,
  ...(body !== undefined
    ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {}),
});

const NEW_REQUEST = {
  person: { kind: "account", subjectId: "user_1" },
  reason: "full_copy",
  channel: "email",
  receivedOn: "2026-11-02",
  identity: "confirmed",
  products: ["account", "bid"],
};

describe("data requests access", () => {
  const routes: [string, string, unknown?][] = [
    ["GET", "/data-requests"],
    ["GET", "/data-requests/summary"],
    ["GET", "/data-requests/account?email=lena%40north.com"],
    ["GET", "/data-requests/DR-0001"],
    ["GET", "/data-requests/DR-0001/holds"],
    ["POST", "/data-requests", NEW_REQUEST],
    ["PATCH", "/data-requests/DR-0001", { version: 1, notes: "x" }],
    ["POST", "/data-requests/DR-0001/close", { version: 1, outcome: "sent" }],
    ["POST", "/data-requests/DL-7F3C1A/continue"],
    [
      "POST",
      "/data-requests/DR-0001/enquiry-erasure",
      { confirmation: "lena@north.com", reason: "Asked to be forgotten" },
    ],
  ];

  it.each(userStaffRoles)(
    "%s: every route answers as the data requests permission says",
    async (role) => {
      const allowed = role === "administrator" || role === "compliance";
      for (const [method, path, body] of routes) {
        const { app, dataRequests } = createApp([role]);
        const res = await app.request(`http://test${path}`, send(method, body));
        expect(res.status === 403, `${method} ${path}`).toBe(!allowed);
        if (!allowed) {
          for (const call of Object.values(dataRequests)) expect(call).not.toHaveBeenCalled();
        }
      }
    },
  );

  it("refuses read-only staff and anyone with no staff role", async () => {
    expect((await createApp(["read_only"]).app.request("http://test/data-requests")).status).toBe(
      403,
    );
    expect((await createApp(undefined).app.request("http://test/data-requests")).status).toBe(403);
  });
});

describe("data requests routes", () => {
  const compliance = () => createApp(["compliance"]);

  it("lists with parsed filters, wrapped in data and never cached", async () => {
    const { app, dataRequests } = compliance();
    const res = await app.request("http://test/data-requests?view=overdue&product=bid");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { items: [], nextCursor: null } });
    expect(dataRequests.list).toHaveBeenCalledWith({
      view: "overdue",
      product: "bid",
      sort: "due",
    });
  });

  it("refuses an unknown view", async () => {
    expect(
      (await compliance().app.request("http://test/data-requests?view=everything")).status,
    ).toBe(400);
  });

  it("answers the summary before treating the word as a reference", async () => {
    const { app, dataRequests } = compliance();
    const res = await app.request("http://test/data-requests/summary");
    expect(await res.json()).toEqual({ data: { open: 1 } });
    expect(dataRequests.record).not.toHaveBeenCalled();
  });

  it("finds an account by a full email address, and refuses anything that is not one", async () => {
    const { app, dataRequests } = compliance();
    const res = await app.request("http://test/data-requests/account?email=lena%40north.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { subjectId: "user_1", name: "Lena", status: "active" },
    });
    expect(dataRequests.findAccount).toHaveBeenCalledWith("lena@north.com");
    expect((await app.request("http://test/data-requests/account?email=lena")).status).toBe(400);
    expect(dataRequests.record).not.toHaveBeenCalled();
  });

  it("opens a record as the signed-in staff member, upper-casing the reference", async () => {
    const { app, dataRequests } = compliance();
    const res = await app.request("http://test/data-requests/dr-0001");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(dataRequests.record).toHaveBeenCalledWith("DR-0001", "staff-1");
  });

  it("lists the deals holding a person's records, for the signed-in staff member", async () => {
    const { app, dataRequests } = compliance();
    dataRequests.dealHolds.mockResolvedValueOnce({
      ok: true,
      value: { holds: [{ dealReference: "PS-0012", status: "open", heldUntil: null }] },
    });
    const res = await app.request("http://test/data-requests/dr-0001/holds");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      data: { holds: [{ dealReference: "PS-0012", status: "open", heldUntil: null }] },
    });
    expect(dataRequests.dealHolds).toHaveBeenCalledWith("DR-0001", "staff-1");
  });

  it("refuses something that is not a reference", async () => {
    const { app, dataRequests } = compliance();
    expect((await app.request("http://test/data-requests/lena%40north.com")).status).toBe(400);
    expect(dataRequests.record).not.toHaveBeenCalled();
  });

  it("logs a request with the acting person taken from the session, never from the body", async () => {
    const { app, dataRequests } = compliance();
    const res = await app.request(
      "http://test/data-requests",
      send("POST", { ...NEW_REQUEST, actorSubjectId: "someone-else" }),
    );
    expect(res.status).toBe(201);
    expect(dataRequests.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ actorSubjectId: expect.anything() }),
      "staff-1",
    );
  });

  it("edits, extends, closes and continues for the acting person", async () => {
    const { app, dataRequests } = compliance();
    await app.request(
      "http://test/data-requests/DR-0001",
      send("PATCH", { version: 2, notes: "Called" }),
    );
    expect(dataRequests.patch).toHaveBeenCalledWith(
      "DR-0001",
      { version: 2, notes: "Called" },
      "staff-1",
    );
    await app.request(
      "http://test/data-requests/DR-0001/extend",
      send("POST", {
        version: 2,
        months: 2,
        reason: "complex",
        note: "Archive",
        personToldOn: "2026-11-10",
        personToldVia: "email",
      }),
    );
    expect(dataRequests.extend).toHaveBeenCalledWith(
      "DR-0001",
      expect.objectContaining({ months: 2 }),
      "staff-1",
    );
    await app.request(
      "http://test/data-requests/DR-0001/close",
      send("POST", { version: 2, outcome: "sent" }),
    );
    expect(dataRequests.close).toHaveBeenCalledWith(
      "DR-0001",
      { version: 2, outcome: "sent" },
      "staff-1",
    );
    const continued = await app.request(
      "http://test/data-requests/DL-7F3C1A/continue",
      send("POST"),
    );
    expect(continued.status).toBe(201);
    expect(dataRequests.continueDownload).toHaveBeenCalledWith("DL-7F3C1A", "staff-1");
  });

  it("refuses a body that breaks the rules before Identity is called", async () => {
    const { app, dataRequests } = compliance();
    expect(
      (
        await app.request(
          "http://test/data-requests/DR-0001/close",
          send("POST", { version: 1, outcome: "refused" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          "http://test/data-requests/DR-0001/extend",
          send("POST", { version: 1, months: 5 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await app.request("http://test/data-requests", send("POST", { person: {} }))).status,
    ).toBe(400);
    expect(dataRequests.close).not.toHaveBeenCalled();
    expect(dataRequests.extend).not.toHaveBeenCalled();
    expect(dataRequests.create).not.toHaveBeenCalled();
  });

  it.each([
    [403, "own_request"],
    [404, "not_found"],
    [409, "stale_version"],
    [422, "extension_after_due_date"],
  ])("passes Identity's %i refusal %s through with its code", async (status, error) => {
    const { app, dataRequests } = compliance();
    dataRequests.extend.mockResolvedValueOnce({ ok: false, status, error });
    const res = await app.request(
      "http://test/data-requests/DR-0001/extend",
      send("POST", {
        version: 1,
        months: 1,
        reason: "complex",
        note: "x",
        personToldOn: "2026-11-10",
        personToldVia: "email",
      }),
    );
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("answers 503 when Identity is unavailable", async () => {
    const { app, dataRequests } = compliance();
    dataRequests.summary.mockRejectedValueOnce(new DataRequestsUnavailableError());
    const res = await app.request("http://test/data-requests/summary");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "data_requests_unavailable" });
  });
});

describe("POST /data-requests/:reference/enquiry-erasure", () => {
  const body = { confirmation: "lena@north.com", reason: "Asked to be forgotten" };
  const url = "http://test/data-requests/dr-0001/enquiry-erasure";

  it("passes the reference and the typed confirmation, never an email address, and returns counts", async () => {
    const { app, dataRequests } = createApp(["compliance"]);
    const res = await app.request(url, send("POST", { ...body, email: "someone@else.com" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { enquiries: 2, held: 1 } });
    expect(dataRequests.eraseEnquiries).toHaveBeenCalledWith("DR-0001", body, "staff-1");
  });

  it("keeps the service's refusal status and code", async () => {
    const { app, dataRequests } = createApp(["compliance"]);
    dataRequests.eraseEnquiries.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "erasure_not_allowed",
    });
    const res = await app.request(url, send("POST", body));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "erasure_not_allowed" });
  });

  it("refuses a short reason", async () => {
    const { app, dataRequests } = createApp(["compliance"]);
    const res = await app.request(url, send("POST", { ...body, reason: "no" }));
    expect(res.status).toBe(400);
    expect(dataRequests.eraseEnquiries).not.toHaveBeenCalled();
  });
});
