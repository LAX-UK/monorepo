import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { X_LEGAL_ENTITY_ID_HEADER } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPaymentRoutes } from "./payments.js";

const paymentId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

function mount(role: string, membershipRole?: string) {
  const app = new Hono();
  const paymentService = {
    listAllForAdmin: vi.fn(),
    createPendingForWinner: vi.fn(),
    markCapturedByAdmin: vi.fn().mockReturnValue({ match: (ok: () => Response) => ok() }),
    refundPayment: vi.fn().mockReturnValue({ match: (ok: () => Response) => ok() }),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    paymentService,
    legalEntityRepository: {
      findActiveMembership: vi.fn().mockImplementation((userId: string, legalEntityId: string) =>
        membershipRole
          ? Promise.resolve({
              userId,
              legalEntityId,
              role: membershipRole,
              isPrimaryAdmin: false,
            })
          : Promise.resolve(null),
      ),
    },
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role }),
  };
  app.route("/payments", createPaymentRoutes(container, authenticator));
  return { app, paymentService };
}

describe("payment finance entity authorization", () => {
  it("returns 403 for accountant refund without acting entity context", async () => {
    const { app, paymentService } = mount("accountant");

    const res = await app.request(`/payments/${paymentId}/refund`, { method: "POST" });

    expect(res.status).toBe(403);
    expect(paymentService.refundPayment).not.toHaveBeenCalled();
  });

  it("returns 403 for accountant capture without finance membership", async () => {
    const { app, paymentService } = mount("accountant", "viewer");

    const res = await app.request(`/payments/${paymentId}/capture`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(403);
    expect(paymentService.markCapturedByAdmin).not.toHaveBeenCalled();
  });

  it("allows finance member refund for their acting entity", async () => {
    const { app, paymentService } = mount("accountant", "finance");

    const res = await app.request(`/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(200);
    expect(paymentService.refundPayment).toHaveBeenCalledWith("u1", "accountant", paymentId, entityId);
  });

  it("allows administrator capture without entity context", async () => {
    const { app, paymentService } = mount("administrator");

    const res = await app.request(`/payments/${paymentId}/capture`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(paymentService.markCapturedByAdmin).toHaveBeenCalledWith(
      "administrator",
      paymentId,
      undefined,
    );
  });
});
