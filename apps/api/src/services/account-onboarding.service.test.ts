import type { IAccountOnboardingRepository } from "@auction/persistence/interfaces";
import { err } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AccountOnboardingService } from "./account-onboarding.service.js";
import type { IInvitationConsumption } from "./invitation-consumption.service.js";

function createRepo(
  overrides?: Partial<IAccountOnboardingRepository>,
): IAccountOnboardingRepository {
  return {
    getStatus: vi.fn(async () => ({ termsAcceptedAt: null })),
    completeOnboarding: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createInvites(overrides?: Partial<IInvitationConsumption>): IInvitationConsumption {
  return {
    validateForRegistration: vi.fn(),
    consumeInviteForNewUser: vi.fn(),
    ...overrides,
  };
}

describe("AccountOnboardingService", () => {
  it("completes onboarding when profile is incomplete", async () => {
    const repo = createRepo();
    const svc = new AccountOnboardingService(repo, createInvites());

    const result = await svc.complete({
      userId: "u1",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      persona: "individual",
      webOrigin: "https://lax.bid",
    });

    expect(result).toEqual({ ok: true });
    expect(repo.completeOnboarding).toHaveBeenCalledOnce();
  });

  it("returns 409 when onboarding is already complete", async () => {
    const repo = createRepo({
      getStatus: vi.fn(async () => ({ termsAcceptedAt: new Date() })),
    });
    const svc = new AccountOnboardingService(repo, createInvites());

    const result = await svc.complete({
      userId: "u1",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      persona: "individual",
      webOrigin: "https://lax.bid",
    });

    expect(result).toMatchObject({ ok: false, status: 409, code: "already_complete" });
    expect(repo.completeOnboarding).not.toHaveBeenCalled();
  });

  it("does not write profile when invite consumption fails", async () => {
    const invites = createInvites({
      validateForRegistration: vi.fn(async () =>
        err({ message: "Invalid invitation", status: 400 as const }),
      ),
    });
    const repo = createRepo();
    const svc = new AccountOnboardingService(repo, invites);

    const result = await svc.complete({
      userId: "u1",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      persona: "individual",
      inviteToken: "token-token-token-token",
      webOrigin: "https://lax.bid",
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.completeOnboarding).not.toHaveBeenCalled();
  });
});
