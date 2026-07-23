import { describe, expect, it, vi } from "vitest";
import { PayoutStatementApplicationService } from "./payout-statement-application.service.js";

describe("PayoutStatementApplicationService", () => {
  it("resolveForLegalEntityMember enforces membership and entity scope", async () => {
    const legalEntityRepository = {
      findActiveMembership: vi.fn().mockResolvedValue({ role: "viewer" }),
    };
    const payoutRepository = { findById: vi.fn() };
    const payoutStatementQueue = { add: vi.fn() };
    const svc = new PayoutStatementApplicationService(
      legalEntityRepository as never,
      payoutRepository as never,
      payoutStatementQueue as never,
    );

    const forbidden = await svc.resolveForLegalEntityMember({
      userId: "u1",
      legalEntityId: "le1",
      payoutId: "p1",
    });
    expect(forbidden).toEqual({
      kind: "forbidden",
      error: "insufficient_role_for_statement",
    });

    legalEntityRepository.findActiveMembership.mockResolvedValue({ role: "owner" });
    payoutRepository.findById.mockResolvedValue({
      id: "p1",
      legalEntityId: "other",
    });
    const notFound = await svc.resolveForLegalEntityMember({
      userId: "u1",
      legalEntityId: "le1",
      payoutId: "p1",
    });
    expect(notFound).toEqual({ kind: "not_found" });
  });

  it("resolveForAdmin skips membership checks", async () => {
    const payoutRepository = {
      findById: vi.fn().mockResolvedValue({
        id: "p1",
        legalEntityId: "le1",
        statementUrl: "https://cdn.example/statement.pdf",
      }),
    };
    const svc = new PayoutStatementApplicationService(
      { findActiveMembership: vi.fn() } as never,
      payoutRepository as never,
      { add: vi.fn() } as never,
    );

    const outcome = await svc.resolveForAdmin("p1");
    expect(outcome).toEqual({
      kind: "redirect",
      url: "https://cdn.example/statement.pdf",
    });
    expect(payoutRepository.findById).toHaveBeenCalledWith("p1");
  });
});
