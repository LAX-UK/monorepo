import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserInvitationRepository } from "./interfaces/invitation.js";
import { InvitationConsumptionService } from "./invitation-consumption.service.js";

function makeRepo() {
  return {
    insert: vi.fn(),
    findById: vi.fn(),
    findPendingByTokenHash: vi.fn(),
    findPendingPlatformByEmail: vi.fn(),
    consumeForNewUser: vi.fn(),
    listAdminCreatedBy: vi.fn(),
    countsForActor: vi.fn(),
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
    vi.mocked(repo.consumeForNewUser).mockResolvedValue({ outcome: "ok", targetRole: "staff" });
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
