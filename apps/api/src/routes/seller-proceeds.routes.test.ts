import { normalizeStaffRoles } from "@auction/types";
import { SIGNED_AGREEMENT_MESSAGES } from "@auction/validators";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerSellerProceedsRoutesSlice } from "../container/container-slices.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { SellerProceedsError } from "../services/seller-proceeds/seller-proceeds-errors.js";
import { createAdminSellerProceedsRoutes } from "./seller-proceeds.js";

const LOT = "11111111-1111-4111-8111-111111111111";
const UPLOAD = "22222222-2222-4222-8222-222222222222";
const PAYOUT = "33333333-3333-4333-8333-333333333333";
const OLD_RULE_ROW = {
  lineId: "line-1",
  payoutId: PAYOUT,
  payoutCreatedAt: new Date("2026-09-30T09:00:00Z"),
  paidAt: new Date("2026-10-01T09:00:00Z"),
  legalEntityId: "seller-1",
  sellerName: "Northbank Gallery Ltd",
  lotId: "lot-1",
  lotNumber: 12,
  lotTitle: "Harbour at Dusk",
  paymentAmount: "1250.00",
  platformFee: "62.50",
  hammerPence: 100_000,
  agreement: {
    reference: "C-1042",
    submissionId: "sub-1",
    signedAt: new Date("2026-08-01T10:00:00Z"),
    source: "online",
    commissionPercent: "12.00",
  },
};

const BODY = {
  commissionPercent: "12",
  signedOn: "2026-10-03",
  uploadObjectId: UPLOAD,
  reason: "Signed on paper at the gallery",
};

type Who = { role: string; staffRoles: string[]; recent?: boolean } | null;

function build(who: Who) {
  const reader = { forLot: vi.fn().mockResolvedValue({ lotId: LOT }) };
  const recordAgreement = {
    record: vi.fn().mockResolvedValue({
      agreementId: "a",
      releasedSellerTermsId: "t",
      sellerNetPence: 530_720,
    }),
  };
  const payoutSales = {
    forPayout: vi.fn().mockResolvedValue({ payout: { id: PAYOUT }, sales: [], heldForSeller: [] }),
    heldSales: vi.fn().mockResolvedValue([]),
    oldRuleSales: vi.fn().mockResolvedValue({ rows: [OLD_RULE_ROW], total: 1 }),
  };
  const vatSetting = { read: vi.fn().mockResolvedValue("standard") };
  const container = {
    sellerProceeds: { reader, recordAgreement, payoutSales, vatSetting },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    admin: { stepUp: { isRecent: vi.fn().mockResolvedValue(who?.recent ?? true) } },
  } as unknown as ContainerSellerProceedsRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(
      who && {
        id: "usr_1",
        identitySessionId: "session-1",
        role: who.role,
        staffRoles: normalizeStaffRoles(who.staffRoles),
        scopes: ["bid.read", "bid.write"],
      },
    ),
  };
  const app = new Hono();
  app.route("/admin/seller-proceeds", createAdminSellerProceedsRoutes(container, authenticator));
  return { app, reader, recordAgreement, payoutSales };
}

const get = (app: Hono, path: string) => app.request(`http://test/admin/seller-proceeds${path}`);
const post = (app: Hono, path: string, body: unknown) =>
  app.request(`http://test/admin/seller-proceeds${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const staff = (role: string, recent = true): Who => ({
  role: "staff",
  staffRoles: [role],
  recent,
});

describe("seller proceeds routes", () => {
  describe("reading a lot's seller proceeds", () => {
    it.each(["administrator", "sales_manager", "cataloguer", "finance", "read_only"])(
      "%s can read them",
      async (role) => {
        const { app } = build(staff(role));
        expect((await get(app, `/lots/${LOT}`)).status).toBe(200);
      },
    );

    it("turns away anonymous callers and clients", async () => {
      expect((await get(build(null).app, `/lots/${LOT}`)).status).toBe(401);
      expect(
        (await get(build({ role: "client", staffRoles: [] }).app, `/lots/${LOT}`)).status,
      ).toBe(403);
    });

    it("answers not found for an unknown lot and refuses a malformed id", async () => {
      const { app, reader } = build(staff("administrator"));
      reader.forLot.mockResolvedValue(null);
      expect((await get(app, `/lots/${LOT}`)).status).toBe(404);
      expect((await get(app, "/lots/not-a-uuid")).status).toBe(400);
    });
  });

  describe("recording a signed agreement", () => {
    const path = `/lots/${LOT}/signed-agreement`;

    it.each([
      ["administrator", 200],
      ["sales_manager", 200],
      ["finance", 200],
      ["cataloguer", 403],
      ["specialist", 403],
      ["client_services", 403],
      ["read_only", 403],
    ])("%s gets %i", async (role, status) => {
      const { app, recordAgreement } = build(staff(role));
      const res = await post(app, path, BODY);
      expect(res.status).toBe(status);
      if (status === 403) expect(recordAgreement.record).not.toHaveBeenCalled();
    });

    it("asks for a fresh sign-in first", async () => {
      const { app, recordAgreement } = build(staff("sales_manager", false));
      const res = await post(app, path, BODY);
      expect(res.status).toBe(403);
      expect(recordAgreement.record).not.toHaveBeenCalled();
    });

    it("passes the fields and who is recording, and whether they are an Administrator", async () => {
      const { app, recordAgreement } = build(staff("administrator"));
      await post(app, path, { ...BODY, replace: true });
      expect(recordAgreement.record).toHaveBeenCalledWith({
        lotId: LOT,
        ...BODY,
        replace: true,
        actor: { userId: "usr_1", isAdministrator: true },
      });
    });

    it("never treats a sales manager as an Administrator", async () => {
      const { app, recordAgreement } = build(staff("sales_manager"));
      await post(app, path, BODY);
      expect(recordAgreement.record.mock.calls[0]?.[0].actor.isAdministrator).toBe(false);
    });

    it("refuses a body of the wrong shape before the service sees it", async () => {
      const { app, recordAgreement } = build(staff("administrator"));
      const res = await post(app, path, { ...BODY, uploadObjectId: "not-a-uuid" });
      expect(res.status).toBe(400);
      expect(recordAgreement.record).not.toHaveBeenCalled();
    });

    it("answers a refusal with its code, sentence and field errors", async () => {
      const { app, recordAgreement } = build(staff("administrator"));
      recordAgreement.record.mockRejectedValue(
        new SellerProceedsError("invalid_agreement", 422, "Check the agreement's details.", {
          document: SIGNED_AGREEMENT_MESSAGES.document,
        }),
      );
      const res = await post(app, path, BODY);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        error: "Check the agreement's details.",
        code: "invalid_agreement",
        fields: { document: SIGNED_AGREEMENT_MESSAGES.document },
      });
    });
  });

  describe("payout lines, held sales and the old-rule review", () => {
    it.each([
      ["administrator", 200],
      ["finance", 200],
      ["sales_manager", 403],
      ["cataloguer", 403],
    ])("%s gets %i", async (role, status) => {
      const { app } = build(staff(role));
      expect((await get(app, `/payouts/${PAYOUT}`)).status).toBe(status);
      expect((await get(app, "/held-sales")).status).toBe(status);
      expect((await get(app, "/old-rule")).status).toBe(status);
    });

    it("answers not found for an unknown payout", async () => {
      const { app, payoutSales } = build(staff("finance"));
      payoutSales.forPayout.mockResolvedValue(null);
      expect((await get(app, `/payouts/${PAYOUT}`)).status).toBe(404);
    });

    it("pages the old-rule review and sets each sale beside what its agreement gives", async () => {
      const { app, payoutSales } = build(staff("finance"));
      const res = await get(app, "/old-rule?limit=20&offset=40");
      expect(payoutSales.oldRuleSales).toHaveBeenCalledWith({ limit: 20, offset: 40 });
      const body = (await res.json()) as {
        data: { paidNetPence: number; agreementGives: { netPence: number } }[];
        meta: unknown;
      };
      expect(body.meta).toEqual({ total: 1, limit: 20, offset: 40 });
      expect(body.data[0]).toMatchObject({
        paidNetPence: 118_750,
        agreementGives: { kind: "priced", netPence: 85_600 },
      });
    });

    it("refuses an out-of-range page size", async () => {
      const { app } = build(staff("finance"));
      expect((await get(app, "/old-rule?limit=1000")).status).toBe(400);
    });
  });
});
