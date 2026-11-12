import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminMarketingEnquiryRoutes } from "./marketing-enquiries.routes.js";

const ID = "00000000-0000-4000-8000-000000000004";

function createApp(staffRoles: StaffRoles | undefined) {
  const marketingEnquiries = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    detail: vi.fn().mockResolvedValue({ id: ID, status: "new" }),
    update: vi.fn().mockResolvedValue({ ok: true, enquiry: { id: ID, status: "in_progress" } }),
    markHandled: vi.fn().mockResolvedValue({ ok: true, enquiry: { id: ID, status: "closed" } }),
  };
  const enquiryConversion = {
    convert: vi.fn().mockResolvedValue({ ok: true, reference: "PS-0012" }),
  };
  const enquiryRouting = {
    rules: vi.fn().mockResolvedValue([]),
    assignees: vi.fn().mockResolvedValue([{ id: "u1", name: "Sofia Okafor" }]),
    replace: vi.fn().mockResolvedValue({ ok: true, rules: [] }),
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
  attachAdminMarketingEnquiryRoutes(
    app as never,
    {
      admin: { marketingEnquiries, enquiryRouting, enquiryConversion },
    } as never,
  );
  return { app, marketingEnquiries, enquiryRouting, enquiryConversion };
}

const json = (body: unknown) => ({
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("who the desk is told is asking", () => {
  it.each([
    ["client_services", { readsGeneral: true, readsPrivateSale: true, canAssign: true }],
    ["administrator", { readsGeneral: true, readsPrivateSale: true, canAssign: true }],
    ["specialist", { readsGeneral: false, readsPrivateSale: true, canAssign: true }],
    ["sales_manager", { readsGeneral: false, readsPrivateSale: true, canAssign: true }],
  ] as const)("%s", async (role, expected) => {
    const { app, marketingEnquiries } = createApp([role]);
    const res = await app.request("http://test/enquiries/E-1042");
    expect(res.status).toBe(200);
    expect(marketingEnquiries.detail).toHaveBeenCalledWith(
      { userId: "staff-1", ...expected },
      "E-1042",
    );
  });
});

describe("GET /enquiries", () => {
  it("lists a view with its filters and passes the cursor on", async () => {
    const { app, marketingEnquiries } = createApp(["client_services"]);
    const res = await app.request(
      "http://test/enquiries?view=private_sales&kind=private_sale_sell&department=paintings&limit=10&cursor=abc",
    );
    expect(res.status).toBe(200);
    expect(marketingEnquiries.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-1" }),
      expect.objectContaining({
        view: "private_sales",
        kind: "private_sale_sell",
        department: "paintings",
        limit: 10,
        cursor: "abc",
      }),
    );
  });

  it("rejects a view that does not exist", async () => {
    const { app, marketingEnquiries } = createApp(["administrator"]);
    expect((await app.request("http://test/enquiries?view=mine")).status).toBe(400);
    expect(marketingEnquiries.list).not.toHaveBeenCalled();
  });
});

describe("GET /enquiries/:ref", () => {
  it("opens by reference or id", async () => {
    const { app, marketingEnquiries } = createApp(["client_services"]);
    expect((await app.request(`http://test/enquiries/${ID}`)).status).toBe(200);
    expect(marketingEnquiries.detail).toHaveBeenCalledWith(expect.anything(), ID);
  });

  it("answers 404 for an enquiry that does not exist or may not be seen", async () => {
    const { app, marketingEnquiries } = createApp(["administrator"]);
    marketingEnquiries.detail.mockResolvedValue(null);
    expect((await app.request("http://test/enquiries/E-1042")).status).toBe(404);
  });

  it("rejects a reference that is neither E-number nor id", async () => {
    const { app } = createApp(["administrator"]);
    expect((await app.request("http://test/enquiries/not-an-id")).status).toBe(400);
  });
});

describe("PATCH /enquiries/:ref", () => {
  it("applies the change as the signed-in person", async () => {
    const { app, marketingEnquiries } = createApp(["specialist"]);
    const res = await app.request(
      "http://test/enquiries/E-1042",
      json({ version: 3, status: "in_progress", note: "Called." }),
    );
    expect(res.status).toBe(200);
    expect(marketingEnquiries.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-1" }),
      "staff-1",
      "E-1042",
      { version: 3, status: "in_progress", note: "Called." },
    );
  });

  it("answers 409 with the current version for a stale write", async () => {
    const { app, marketingEnquiries } = createApp(["specialist"]);
    marketingEnquiries.update.mockResolvedValue({
      ok: false,
      error: "stale_version",
      currentVersion: 4,
    });
    const res = await app.request("http://test/enquiries/E-1042", json({ version: 3, note: "x" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stale_version", currentVersion: 4 });
  });

  it.each([
    ["enquiry_not_found", 404],
    ["assign_forbidden", 403],
    ["close_reason_required", 422],
    ["not_allowed", 422],
  ])("answers %s with %i", async (error, status) => {
    const { app, marketingEnquiries } = createApp(["specialist"]);
    marketingEnquiries.update.mockResolvedValue({ ok: false, error });
    const res = await app.request(
      "http://test/enquiries/E-1042",
      json({ version: 1, status: "closed" }),
    );
    expect(res.status).toBe(status);
  });

  it.each([
    ["no version", { status: "closed", closeReason: "spam" }],
    ["nothing to change", { version: 1 }],
    ["an unknown status", { version: 1, status: "done" }],
    ["an unknown close reason", { version: 1, status: "closed", closeReason: "bored" }],
  ])("rejects %s", async (_label, body) => {
    const { app, marketingEnquiries } = createApp(["administrator"]);
    expect((await app.request("http://test/enquiries/E-1042", json(body))).status).toBe(400);
    expect(marketingEnquiries.update).not.toHaveBeenCalled();
  });
});

const OWN_WORK = { notInRegister: { reason: "sellers_own_work" } } as const;

describe("POST /enquiries/:ref/convert", () => {
  const post = (body: unknown) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  it("turns the enquiry into a deal as the signed-in person and returns its reference", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    const res = await app.request("http://test/enquiries/E-1042/convert", post(OWN_WORK));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { reference: "PS-0012" } });
    expect(enquiryConversion.convert).toHaveBeenCalledWith(
      { userId: "staff-1", readsPrivateSale: true },
      "E-1042",
      OWN_WORK,
    );
  });

  it("passes the work a buy enquiry is about", async () => {
    const { app, enquiryConversion } = createApp(["sales_manager"]);
    await app.request(
      "http://test/enquiries/E-1042/convert",
      post({ workReference: "C-1042", ...OWN_WORK }),
    );
    expect(enquiryConversion.convert).toHaveBeenCalledWith(expect.anything(), "E-1042", {
      workReference: "C-1042",
      ...OWN_WORK,
    });
  });

  it("is for those who run deals: client services can read the enquiry but not convert it", async () => {
    const { app, enquiryConversion } = createApp(["client_services"]);
    expect((await app.request("http://test/enquiries/E-1042/convert", post({}))).status).toBe(403);
    expect(enquiryConversion.convert).not.toHaveBeenCalled();
  });

  it.each([
    ["enquiry_not_found", 404],
    ["already_converted", 409],
    ["stale_version", 409],
    ["account_required", 422],
    ["work_required", 422],
    ["not_ready", 422],
  ] as const)("answers %s with %i", async (error, status) => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    enquiryConversion.convert.mockResolvedValueOnce({ ok: false, error });
    const res = await app.request("http://test/enquiries/E-1042/convert", post(OWN_WORK));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("answers an artwork the register will not hold with the lock's reason, words and link", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    const lock = {
      reason: "live_on_lax_art",
      message: "This artwork is live on lax.art. Take it off lax.art first.",
      link: { label: "Open on lax.art", target: "lax_art_listing" },
    };
    enquiryConversion.convert.mockResolvedValueOnce({
      ok: false,
      error: "artwork_unavailable",
      message: lock.message,
      lock,
    });
    const res = await app.request(
      "http://test/enquiries/E-1042/convert",
      post({ artworkRegisterId: "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "artwork_unavailable", message: lock.message, lock });
  });

  it("passes the artwork chosen from the register", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    const artworkRegisterId = "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11";
    await app.request("http://test/enquiries/E-1042/convert", post({ artworkRegisterId }));
    expect(enquiryConversion.convert).toHaveBeenCalledWith(expect.anything(), "E-1042", {
      artworkRegisterId,
    });
  });

  it.each([
    ["neither the artwork nor a reason", {}],
    ["both", { artworkRegisterId: "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11", ...OWN_WORK }],
  ])(
    "answers %s with 422 artwork_choice_required, from the conversion's own rule",
    async (_label, body) => {
      const { app, enquiryConversion } = createApp(["specialist"]);
      enquiryConversion.convert.mockResolvedValueOnce({
        ok: false,
        error: "artwork_choice_required",
      });
      const res = await app.request("http://test/enquiries/E-1042/convert", post(body));
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "artwork_choice_required" });
      expect(enquiryConversion.convert).toHaveBeenCalledWith(expect.anything(), "E-1042", body);
    },
  );

  it("rejects a reason that is not offered as a malformed request", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    const res = await app.request(
      "http://test/enquiries/E-1042/convert",
      post({ notInRegister: { reason: "lost" } }),
    );
    expect(res.status).toBe(400);
    expect(enquiryConversion.convert).not.toHaveBeenCalled();
  });

  it("answers a missing artwork choice from the service with 422", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    enquiryConversion.convert.mockResolvedValueOnce({
      ok: false,
      error: "artwork_choice_required",
    });
    const res = await app.request("http://test/enquiries/E-1042/convert", post(OWN_WORK));
    expect(res.status).toBe(422);
  });

  it("rejects a work reference that is not one", async () => {
    const { app, enquiryConversion } = createApp(["specialist"]);
    const res = await app.request(
      "http://test/enquiries/E-1042/convert",
      post({ workReference: "hello", ...OWN_WORK }),
    );
    expect(res.status).toBe(400);
    expect(enquiryConversion.convert).not.toHaveBeenCalled();
  });
});

describe("POST /enquiries/:id/handled", () => {
  it("marks handled as the signed-in person", async () => {
    const { app, marketingEnquiries } = createApp(["client_services"]);
    const res = await app.request(`http://test/enquiries/${ID}/handled`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(marketingEnquiries.markHandled).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-1" }),
      ID,
      "staff-1",
    );
  });

  it("answers 409 when it was already handled and 404 when it is gone", async () => {
    const { app, marketingEnquiries } = createApp(["administrator"]);
    marketingEnquiries.markHandled.mockResolvedValueOnce({ ok: false, error: "already_handled" });
    expect(
      (await app.request(`http://test/enquiries/${ID}/handled`, { method: "POST" })).status,
    ).toBe(409);
    marketingEnquiries.markHandled.mockResolvedValueOnce({ ok: false, error: "enquiry_not_found" });
    expect(
      (await app.request(`http://test/enquiries/${ID}/handled`, { method: "POST" })).status,
    ).toBe(404);
  });
});

describe("enquiry routing", () => {
  const rules = { rules: [{ departmentSlug: "paintings", assignedToUserId: "sofia" }] };
  const put = (body: unknown) => ({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  it("is readable by everyone who works enquiries", async () => {
    for (const role of [
      "client_services",
      "specialist",
      "sales_manager",
      "administrator",
    ] as const) {
      const { app } = createApp([role]);
      expect((await app.request("http://test/enquiry-routing")).status).toBe(200);
    }
  });

  it("is changed by administrators and sales managers, as the signed-in person", async () => {
    for (const role of ["administrator", "sales_manager"] as const) {
      const { app, enquiryRouting } = createApp([role]);
      expect((await app.request("http://test/enquiry-routing", put(rules))).status).toBe(200);
      expect(enquiryRouting.replace).toHaveBeenCalledWith("staff-1", rules.rules);
    }
  });

  it.each([["client_services"], ["specialist"]] as const)(
    "cannot be changed by %s",
    async (role) => {
      const { app, enquiryRouting } = createApp([role]);
      expect((await app.request("http://test/enquiry-routing", put(rules))).status).toBe(403);
      expect(enquiryRouting.replace).not.toHaveBeenCalled();
    },
  );

  it("refuses a table that names a department twice, and a specialist who is not staff", async () => {
    const { app, enquiryRouting } = createApp(["administrator"]);
    const twice = { rules: [...rules.rules, ...rules.rules] };
    expect((await app.request("http://test/enquiry-routing", put(twice))).status).toBe(400);
    enquiryRouting.replace.mockResolvedValue({ ok: false, error: "assignee_invalid", userId: "x" });
    expect((await app.request("http://test/enquiry-routing", put(rules))).status).toBe(422);
  });
});

describe("GET /enquiry-assignees", () => {
  it("names the staff an enquiry may be given to, for everyone who opens the desk", async () => {
    for (const role of [
      "administrator",
      "sales_manager",
      "specialist",
      "client_services",
    ] as const) {
      const { app } = createApp([role]);
      const res = await app.request("http://test/enquiry-assignees");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        data: { assignees: [{ id: "u1", name: "Sofia Okafor" }] },
      });
    }
  });
});

describe("who may open the Enquiries routes", () => {
  it.each([
    ["finance"],
    ["read_only"],
    ["cataloguer"],
    ["fulfilment"],
    ["compliance"],
    ["saleroom_clerk"],
  ] as const)("refuses %s everywhere", async (role) => {
    const { app, marketingEnquiries, enquiryRouting } = createApp([role]);
    for (const [path, init] of [
      ["/enquiries", undefined],
      [`/enquiries/${ID}`, undefined],
      ["/enquiries/E-1042", json({ version: 1, note: "x" })],
      [`/enquiries/${ID}/handled`, { method: "POST" }],
      ["/enquiry-routing", undefined],
      ["/enquiry-assignees", undefined],
    ] as const) {
      expect((await app.request(`http://test${path}`, init)).status).toBe(403);
    }
    expect(marketingEnquiries.list).not.toHaveBeenCalled();
    expect(marketingEnquiries.update).not.toHaveBeenCalled();
    expect(marketingEnquiries.markHandled).not.toHaveBeenCalled();
    expect(enquiryRouting.rules).not.toHaveBeenCalled();
    expect(enquiryRouting.assignees).not.toHaveBeenCalled();
  });
});
