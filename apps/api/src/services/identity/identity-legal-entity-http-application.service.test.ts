import { describe, expect, it, vi } from "vitest";
import { IdentityLegalEntityHttpApplicationService } from "./identity-legal-entity-http-application.service.js";

describe("IdentityLegalEntityHttpApplicationService", () => {
  it("returns empty invitations when org module is disabled", async () => {
    const svc = new IdentityLegalEntityHttpApplicationService(
      { listActiveMembershipsForUser: vi.fn() } as never,
      { resolveForUser: vi.fn() } as never,
      {
        isEnabled: () => false,
        disabledResponse: () => ({ error: "x", code: "ORG_MODULE_DISABLED" }),
      },
      { getById: vi.fn() } as never,
      { listForEmail: vi.fn() } as never,
      {} as never,
      {} as never,
    );
    const out = await svc.listPendingInvitations({ userId: "u1" });
    expect(out).toEqual({ kind: "ok", data: [] });
  });
});
