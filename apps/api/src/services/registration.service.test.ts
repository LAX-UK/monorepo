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
  return { validator, emailSignup, userProfile, welcome, invitations };
}

describe("RegistrationService", () => {
  it("forwards persona to userProfile.setRegistrationProfile", async () => {
    const deps = makeDeps();
    const svc = new RegistrationService(
      deps.validator,
      deps.emailSignup,
      deps.userProfile,
      deps.welcome,
      deps.invitations,
    );

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
    const svc = new RegistrationService(
      deps.validator,
      deps.emailSignup,
      deps.userProfile,
      deps.welcome,
      deps.invitations,
    );

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

  it("fails registration when profile persistence fails", async () => {
    const deps = makeDeps();
    vi.mocked(deps.userProfile.setRegistrationProfile).mockResolvedValue({
      ok: false,
      message: "db error",
    });
    const svc = new RegistrationService(
      deps.validator,
      deps.emailSignup,
      deps.userProfile,
      deps.welcome,
      deps.invitations,
    );

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
    expect(deps.welcome.notifyWelcome).not.toHaveBeenCalled();
  });

  it("does not consume entity invites at signup", async () => {
    const deps = makeDeps();
    vi.mocked(deps.invitations.validateForRegistration).mockResolvedValue(
      ok({
        targetLegalEntityId: "le-1",
      } as never),
    );
    const svc = new RegistrationService(
      deps.validator,
      deps.emailSignup,
      deps.userProfile,
      deps.welcome,
      deps.invitations,
    );

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
    const svc = new RegistrationService(
      deps.validator,
      deps.emailSignup,
      deps.userProfile,
      deps.welcome,
      deps.invitations,
    );

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
