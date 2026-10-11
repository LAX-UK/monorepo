import type { IUserInvitationRepository } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationConsumptionService } from "./invitation-consumption.service.js";

function makeRepo() {
  return {
    insert: vi.fn(),
    findById: vi.fn(),
    findPendingByTokenHash: vi.fn(),
    findPendingPlatformByEmail: vi.fn(),
    consumeForNewUser: vi.fn(),
    acceptForExistingUser: vi.fn(),
    listGrants: vi.fn(),
    listAdmin: vi.fn(),
    counts: vi.fn(),
    updateStatus: vi.fn(),
    markOpenedFirstTouch: vi.fn(),
  } satisfies IUserInvitationRepository;
}

describe("InvitationConsumptionService.consumeInviteForNewUser", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: InvitationConsumptionService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new InvitationConsumptionService(repo);
  });

  it("maps ok outcome to the target role", async () => {
    vi.mocked(repo.consumeForNewUser).mockResolvedValue({
      outcome: "ok",
      targetRole: "staff",
      grants: [{ product: "bid", role: "specialist" }],
    });
    const res = await svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isOk() && res.value).toBe("staff");
  });

  it("maps expired outcome to a 400 error", async () => {
    vi.mocked(repo.consumeForNewUser).mockResolvedValue({ outcome: "expired" });
    const res = await svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.status).toBe(400);
    expect(res.isErr() && res.error.message).toBe("Invitation expired");
  });

  it("maps email_mismatch outcome to a 400 error", async () => {
    vi.mocked(repo.consumeForNewUser).mockResolvedValue({ outcome: "email_mismatch" });
    const res = await svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Email does not match invitation");
  });

  it("maps invalid outcome to a 400 error", async () => {
    vi.mocked(repo.consumeForNewUser).mockResolvedValue({ outcome: "invalid" });
    const res = await svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Invalid invitation");
  });
});

describe("InvitationConsumptionService.acceptForExistingUser", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: InvitationConsumptionService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new InvitationConsumptionService(repo);
  });

  it("returns the applied grants", async () => {
    vi.mocked(repo.findPendingByTokenHash).mockResolvedValue({
      targetLegalEntityId: null,
    } as never);
    vi.mocked(repo.acceptForExistingUser).mockResolvedValue({
      outcome: "ok",
      targetRole: "client",
      grants: [{ product: "shop", role: "broker" }],
    });
    const res = await svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isOk() && res.value.grants).toEqual([{ product: "shop", role: "broker" }]);
  });

  it("refuses organisation invitations, which have their own accept flow", async () => {
    vi.mocked(repo.findPendingByTokenHash).mockResolvedValue({
      targetLegalEntityId: "le-1",
    } as never);
    const res = await svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Invalid invitation");
    expect(repo.acceptForExistingUser).not.toHaveBeenCalled();
  });

  it("maps email mismatch from the locked accept", async () => {
    vi.mocked(repo.findPendingByTokenHash).mockResolvedValue(null);
    vi.mocked(repo.acceptForExistingUser).mockResolvedValue({ outcome: "email_mismatch" });
    const res = await svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Email does not match invitation");
  });
});
