import { legalEntityMemberRoles } from "@auction/types";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerPayoutRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPayoutRoutes } from "./payouts.js";

const entityId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const payoutId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const CAN_READ_PAYOUTS: LegalEntityMemberRole[] = ["owner", "admin", "finance"];
const CANNOT_READ_PAYOUTS = legalEntityMemberRoles.filter(
  (role) => !CAN_READ_PAYOUTS.includes(role),
);

function mount(role: LegalEntityMemberRole, opts: { isImpersonation?: boolean } = {}) {
  const sellerPayoutHttp = {
    listForLegalEntity: vi.fn(async () => ({ kind: "ok" as const, data: [] })),
    previewPending: vi.fn(async () => ({ kind: "ok" as const, data: {} })),
    getById: vi.fn(async () => ({ kind: "ok" as const, data: {} })),
  };
  const context: LegalEntityContext = {
    legalEntityId: entityId,
    userId: "user-1",
    role,
    isPrimaryAdmin: false,
    ...(opts.isImpersonation ? { isImpersonation: true } : {}),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: { sellerPayoutHttp },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
  } as unknown as ContainerPayoutRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "user-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/payouts", createPayoutRoutes(container, authenticator));
  return { app, sellerPayoutHttp };
}

const READS = [
  ["list", "/payouts", "listForLegalEntity"],
  ["preview-next", "/payouts/preview-next", "previewPending"],
  ["detail", `/payouts/${payoutId}`, "getById"],
] as const;

describe("seller payout reads by organisation role", () => {
  describe.each(READS)("GET %s", (_name, path, method) => {
    it.each(CAN_READ_PAYOUTS)("allows %s", async (role) => {
      const { app, sellerPayoutHttp } = mount(role);

      const res = await app.request(path);

      expect(res.status).toBe(200);
      expect(sellerPayoutHttp[method]).toHaveBeenCalled();
    });

    it.each(CANNOT_READ_PAYOUTS)("refuses %s without touching payout data", async (role) => {
      const { app, sellerPayoutHttp } = mount(role);

      const res = await app.request(path);

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toMatchObject({ error: "insufficient_entity_role" });
      expect(sellerPayoutHttp[method]).not.toHaveBeenCalled();
    });

    it("lets an impersonating admin read", async () => {
      const { app } = mount("admin", { isImpersonation: true });

      expect((await app.request(path)).status).toBe(200);
    });
  });
});
