import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "./registration.service.js";

function makeDeps(overrides?: Partial<{ welcome: ReturnType<typeof vi.fn> }>) {
  const validator = { validate: vi.fn().mockReturnValue({ ok: true }) };
  const emailSignup = {
    signUpEmail: vi.fn().mockResolvedValue({ ok: true, userId: "user-new" }),
  };
  const userProfile = {
    setRegistrationProfile: vi.fn().mockResolvedValue({ ok: true }),
  };
  const welcome = {
    notifyWelcome: overrides?.welcome ?? vi.fn().mockResolvedValue(undefined),
  };
  const invitations = {
    validateForRegistration: vi.fn().mockResolvedValue(ok(undefined)),
    consumeInviteForNewUser: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as ConstructorParameters<typeof RegistrationService>[4];
  const compensator = {
    deleteOrphanedUser: vi.fn().mockResolvedValue({ ok: true }),
  };
  return { validator, emailSignup, userProfile, welcome, invitations, compensator };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new RegistrationService(
    deps.validator,
    deps.emailSignup,
    deps.userProfile,
    deps.welcome,
    deps.invitations,
    deps.compensator,
  );
}

describe("RegistrationService", () => {
  it("forwards persona to userProfile.setRegistrationProfile", async () => {
    const deps = makeDeps();
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "supersecret",
      persona: "organisation",
    });

    expect(result).toEqual({ ok: true, userId: "user-new" });
    expect(deps.userProfile.setRegistrationProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-new",
        firstName: "Ada",
        lastName: "Lovelace",
        persona: "organisation",
      }),
    );
  });

  it("persona individual is also persisted", async () => {
    const deps = makeDeps();
    const svc = makeService(deps);

    await svc.register({
      firstName: "Ben",
      lastName: "Bidder",
      email: "ben@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(deps.userProfile.setRegistrationProfile).toHaveBeenCalledWith(
      expect.objectContaining({ persona: "individual" }),
    );
  });

  it("fails registration and compensates when profile persistence persistently fails", async () => {
    const deps = makeDeps();
    vi.mocked(deps.userProfile.setRegistrationProfile).mockResolvedValue({
      ok: false,
      message: "db error",
    });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Fail",
      lastName: "Profile",
      email: "fail@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({
      ok: false,
      message: "Registration could not be completed. Please try again.",
      status: 500,
    });
    // Retried once, then compensated so the email is not orphaned.
    expect(deps.userProfile.setRegistrationProfile).toHaveBeenCalledTimes(2);
    expect(deps.compensator.deleteOrphanedUser).toHaveBeenCalledWith("user-new");
    expect(deps.welcome.notifyWelcome).not.toHaveBeenCalled();
  });

  it("succeeds when the profile write fails once then succeeds on retry", async () => {
    const deps = makeDeps();
    vi.mocked(deps.userProfile.setRegistrationProfile)
      .mockResolvedValueOnce({ ok: false, message: "transient" })
      .mockResolvedValueOnce({ ok: true });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Retry",
      lastName: "Works",
      email: "retry@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({ ok: true, userId: "user-new" });
    expect(deps.userProfile.setRegistrationProfile).toHaveBeenCalledTimes(2);
    expect(deps.compensator.deleteOrphanedUser).not.toHaveBeenCalled();
  });

  it("still returns 500 when the compensating delete itself fails", async () => {
    const deps = makeDeps();
    vi.mocked(deps.userProfile.setRegistrationProfile).mockResolvedValue({
      ok: false,
      message: "db error",
    });
    vi.mocked(deps.compensator.deleteOrphanedUser).mockResolvedValue({ ok: false });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Comp",
      lastName: "Fails",
      email: "comp@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({
      ok: false,
      message: "Registration could not be completed. Please try again.",
      status: 500,
    });
  });

  it("does not consume entity invites at signup", async () => {
    const deps = makeDeps();
    vi.mocked(deps.invitations.validateForRegistration).mockResolvedValue(
      ok({
        targetLegalEntityId: "le-1",
      } as never),
    );
    const svc = makeService(deps);

    await svc.register({
      firstName: "Inv",
      lastName: "itee",
      email: "inv@example.com",
      password: "supersecret",
      persona: "individual",
      inviteToken: "tok",
    });

    expect(deps.invitations.consumeInviteForNewUser).not.toHaveBeenCalled();
  });

  it("consumes platform staff invites at signup", async () => {
    const deps = makeDeps();
    vi.mocked(deps.invitations.validateForRegistration).mockResolvedValue(
      ok({
        targetLegalEntityId: null,
      } as never),
    );
    const svc = makeService(deps);

    await svc.register({
      firstName: "Staff",
      lastName: "User",
      email: "staff@example.com",
      password: "supersecret",
      persona: "individual",
      inviteToken: "tok",
    });

    expect(deps.invitations.consumeInviteForNewUser).toHaveBeenCalledWith(
      "tok",
      "user-new",
      "staff@example.com",
    );
  });
});
