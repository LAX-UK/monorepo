import type { StaffRoles } from "@auction/types";
import { Hono, type MiddlewareHandler } from "hono";
import { describe, expect, it } from "vitest";
import {
  requireAuctionManage,
  requireCategoriesAccess,
  requireCategoriesRead,
  requireConditionReportsRead,
  requireLotWorkRead,
  requireLotsAccess,
  requireLotsRead,
  requireQrCodesRead,
  requireSaleroomOperate,
  requireSubmissionsAccess,
  requireSubmissionsRead,
  requireVenuesAccessByMethod,
} from "./require-capability.js";

function appWith(middleware: MiddlewareHandler, staffRoles: StaffRoles) {
  const app = new Hono<{ Variables: { userRole?: string; userStaffRoles?: StaffRoles } }>();
  app.use("*", async (c, next) => {
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  app.on(["GET", "POST"], "/t", middleware, (c) => c.json({ ok: true }));
  return app;
}

const status = async (
  middleware: MiddlewareHandler,
  staffRoles: StaffRoles,
  method: "GET" | "POST" = "GET",
) => (await appWith(middleware, staffRoles).request("http://test/t", { method })).status;

describe("admin.read read rules", () => {
  it.each([
    ["lots", requireLotsRead],
    ["lot work", requireLotWorkRead],
    ["submissions", requireSubmissionsRead],
    ["categories", requireCategoriesRead],
    ["condition reports", requireConditionReportsRead],
    ["QR codes", requireQrCodesRead],
  ])("opens %s to read-only staff", async (_name, middleware) => {
    expect(await status(middleware, ["read_only"])).toBe(200);
    expect(await status(middleware, ["finance"])).toBe(403);
  });

  it.each([
    ["lots", requireLotsAccess],
    ["submissions", requireSubmissionsAccess],
    ["categories", requireCategoriesAccess],
  ])("keeps changing %s closed to read-only staff", async (_name, middleware) => {
    expect(await status(middleware, ["read_only"])).toBe(403);
    expect(await status(middleware, ["cataloguer"])).toBe(200);
  });

  it("guards a whole path by method: reads with the read rule, changes with the write rule", async () => {
    expect(await status(requireVenuesAccessByMethod, ["read_only"], "GET")).toBe(200);
    expect(await status(requireVenuesAccessByMethod, ["read_only"], "POST")).toBe(403);
    expect(await status(requireVenuesAccessByMethod, ["cataloguer"], "POST")).toBe(200);
  });
});

describe("saleroom.operate", () => {
  it("lets the saleroom clerk run the saleroom without managing sales", async () => {
    expect(await status(requireSaleroomOperate, ["saleroom_clerk"], "POST")).toBe(200);
    expect(await status(requireSaleroomOperate, ["sales_manager"], "POST")).toBe(200);
    expect(await status(requireSaleroomOperate, ["read_only"])).toBe(403);
    expect(await status(requireAuctionManage, ["saleroom_clerk"], "POST")).toBe(403);
  });
});
