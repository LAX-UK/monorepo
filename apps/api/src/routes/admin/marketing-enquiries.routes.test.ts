import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminMarketingEnquiryRoutes } from "./marketing-enquiries.routes.js";

const ID = "00000000-0000-4000-8000-000000000004";

function createApp(staffRoles: StaffRoles | undefined) {
  const marketingEnquiries = {
    detail: vi.fn().mockResolvedValue({ id: ID, status: "new" }),
    markHandled: vi.fn().mockResolvedValue({ ok: true, enquiry: { id: ID, status: "handled" } }),
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
  attachAdminMarketingEnquiryRoutes(app as never, { admin: { marketingEnquiries } } as never);
  return { app, marketingEnquiries };
}

describe("contact enquiry staff routes", () => {
  it("opens an enquiry for client services", async () => {
    const { app, marketingEnquiries } = createApp(["client_services"]);
    const res = await app.request(`http://test/enquiries/${ID}`);
    expect(res.status).toBe(200);
    expect(marketingEnquiries.detail).toHaveBeenCalledWith(ID);
  });

  it("answers 404 for an enquiry that does not exist", async () => {
    const { app, marketingEnquiries } = createApp(["administrator"]);
    marketingEnquiries.detail.mockResolvedValue(null);
    const res = await app.request(`http://test/enquiries/${ID}`);
    expect(res.status).toBe(404);
  });

  it("rejects an id that is not a UUID", async () => {
    const { app } = createApp(["administrator"]);
    const res = await app.request("http://test/enquiries/not-an-id");
    expect(res.status).toBe(400);
  });

  it("marks handled as the signed-in person", async () => {
    const { app, marketingEnquiries } = createApp(["client_services"]);
    const res = await app.request(`http://test/enquiries/${ID}/handled`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(marketingEnquiries.markHandled).toHaveBeenCalledWith(ID, "staff-1");
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

  it.each([["finance"], ["read_only"], ["cataloguer"], ["sales_manager"]] as const)(
    "refuses %s, for the page and the action",
    async (role) => {
      const { app, marketingEnquiries } = createApp([role]);
      expect((await app.request(`http://test/enquiries/${ID}`)).status).toBe(403);
      expect(
        (await app.request(`http://test/enquiries/${ID}/handled`, { method: "POST" })).status,
      ).toBe(403);
      expect(marketingEnquiries.markHandled).not.toHaveBeenCalled();
    },
  );
});
