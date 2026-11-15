import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminEnquiryQuarantineRoutes } from "./enquiry-quarantine.routes.js";

const ID = "00000000-0000-4000-8000-000000000007";

function createApp(staffRoles: StaffRoles | undefined) {
  const enquiryQuarantine = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, pendingCount: 0 }),
    detail: vi.fn().mockResolvedValue({ id: ID, status: "pending" }),
    attach: vi.fn().mockResolvedValue({ ok: true, enquiryReference: "E-1042", messageId: "m-1" }),
    discard: vi.fn().mockResolvedValue({ ok: true }),
  };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminEnquiryQuarantineRoutes(app as never, { admin: { enquiryQuarantine } } as never);
  return { app, enquiryQuarantine };
}

const post = (body?: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("enquiry quarantine routes: capabilities", () => {
  it.each([["cataloguer"], ["finance"], ["fulfilment"], ["saleroom_clerk"]] as const)(
    "refuses %s every route, before the service is asked",
    async (role) => {
      const { app, enquiryQuarantine } = createApp([role]);
      expect((await app.request("http://test/enquiry-quarantine")).status).toBe(403);
      expect((await app.request(`http://test/enquiry-quarantine/${ID}`)).status).toBe(403);
      expect(
        (
          await app.request(
            `http://test/enquiry-quarantine/${ID}/attach`,
            post({ enquiryReference: "E-1042" }),
          )
        ).status,
      ).toBe(403);
      expect(
        (await app.request(`http://test/enquiry-quarantine/${ID}/discard`, post())).status,
      ).toBe(403);
      for (const fn of Object.values(enquiryQuarantine)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["client_services", { readsGeneral: true, readsPrivateSale: true, canAssign: true }],
    ["administrator", { readsGeneral: true, readsPrivateSale: true, canAssign: true }],
    ["specialist", { readsGeneral: false, readsPrivateSale: true, canAssign: true }],
    ["sales_manager", { readsGeneral: false, readsPrivateSale: true, canAssign: true }],
  ] as const)("tells the service what %s may read and do", async (role, expected) => {
    const { app, enquiryQuarantine } = createApp([role]);
    const res = await app.request("http://test/enquiry-quarantine?view=reviewed&limit=10");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(enquiryQuarantine.list).toHaveBeenCalledWith(
      { userId: "staff-1", ...expected },
      { view: "reviewed", limit: 10 },
    );
  });
});

describe("GET /enquiry-quarantine/:id", () => {
  it("answers 404 for held mail the person may not see, and 400 for a bad id", async () => {
    const { app, enquiryQuarantine } = createApp(["client_services"]);
    enquiryQuarantine.detail.mockResolvedValueOnce(null);
    expect((await app.request(`http://test/enquiry-quarantine/${ID}`)).status).toBe(404);
    expect((await app.request("http://test/enquiry-quarantine/not-a-uuid")).status).toBe(400);
  });
});

describe("POST /enquiry-quarantine/:id/attach", () => {
  it("attaches to the enquiry named, upper-casing the reference", async () => {
    const { app, enquiryQuarantine } = createApp(["client_services"]);
    const res = await app.request(
      `http://test/enquiry-quarantine/${ID}/attach`,
      post({ enquiryReference: "e-1042" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { enquiryReference: "E-1042", messageId: "m-1" } });
    expect(enquiryQuarantine.attach).toHaveBeenCalledWith(expect.anything(), ID, {
      enquiryReference: "E-1042",
    });
  });

  it("refuses a body that names no enquiry, or more than a reference", async () => {
    const { app, enquiryQuarantine } = createApp(["client_services"]);
    for (const body of [{}, { enquiryReference: "1042" }, { enquiryReference: ["E-1", "E-2"] }]) {
      expect(
        (await app.request(`http://test/enquiry-quarantine/${ID}/attach`, post(body))).status,
      ).toBe(400);
    }
    expect(enquiryQuarantine.attach).not.toHaveBeenCalled();
  });

  it.each([
    ["quarantine_not_found", 404],
    ["review_forbidden", 403],
    ["already_reviewed", 409],
    ["enquiry_not_found", 422],
  ] as const)("maps %s to %i", async (error, status) => {
    const { app, enquiryQuarantine } = createApp(["client_services"]);
    enquiryQuarantine.attach.mockResolvedValueOnce({ ok: false, error });
    const res = await app.request(
      `http://test/enquiry-quarantine/${ID}/attach`,
      post({ enquiryReference: "E-1042" }),
    );
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });
});

describe("POST /enquiry-quarantine/:id/discard", () => {
  it("discards, and a second discard is a conflict", async () => {
    const { app, enquiryQuarantine } = createApp(["specialist"]);
    expect((await app.request(`http://test/enquiry-quarantine/${ID}/discard`, post())).status).toBe(
      200,
    );
    enquiryQuarantine.discard.mockResolvedValueOnce({ ok: false, error: "already_reviewed" });
    expect((await app.request(`http://test/enquiry-quarantine/${ID}/discard`, post())).status).toBe(
      409,
    );
  });
});
