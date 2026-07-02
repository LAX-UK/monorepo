import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "./registration.service.js";

function makeDeps(overrides?: Partial<{ welcome: ReturnType<typeof vi.fn> }>) {
  const validator = { validate: vi.fn().mockReturnValue({ ok: true }) };
  const existingAccountReader = {
    findByEmail: vi.fn().mockResolvedValue(null),
  };
  const verificationEmailResender = {
    resend: vi.fn().mockResolvedValue({ ok: true }),
  };
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
  } as unknown as ConstructorParameters<typeof RegistrationService>[6];
  const compensator = {
    deleteOrphanedUser: vi.fn().mockResolvedValue({ ok: true }),
  };
  return {
    validator,
    existingAccountReader,
    verificationEmailResender,
    emailSignup,
    userProfile,
    welcome,
    invitations,
    compensator,
  };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new RegistrationService(
    deps.validator,
    deps.existingAccountReader,
    deps.verificationEmailResender,
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

  it("rejects verified existing email without calling signUpEmail", async () => {
    const deps = makeDeps();
    vi.mocked(deps.existingAccountReader.findByEmail).mockResolvedValue({
      userId: "user-existing",
      emailVerified: true,
    });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Old",
      lastName: "User",
      email: "taken@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({
      ok: false,
      code: "email_already_registered",
      message: "This email is already registered. Sign in or reset your password.",
      status: 409,
    });
    expect(deps.emailSignup.signUpEmail).not.toHaveBeenCalled();
    expect(deps.verificationEmailResender.resend).not.toHaveBeenCalled();
  });

  it("resends verification for unverified existing email and returns success", async () => {
    const deps = makeDeps();
    vi.mocked(deps.existingAccountReader.findByEmail).mockResolvedValue({
      userId: "user-pending",
      emailVerified: false,
    });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Pending",
      lastName: "User",
      email: "pending@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({ ok: true, userId: "user-pending" });
    expect(deps.verificationEmailResender.resend).toHaveBeenCalledWith({
      email: "pending@example.com",
      persona: "individual",
    });
    expect(deps.emailSignup.signUpEmail).not.toHaveBeenCalled();
    expect(deps.userProfile.setRegistrationProfile).not.toHaveBeenCalled();
  });

  it("still returns success when resend fails for unverified existing email", async () => {
    const deps = makeDeps();
    vi.mocked(deps.existingAccountReader.findByEmail).mockResolvedValue({
      userId: "user-pending",
      emailVerified: false,
    });
    vi.mocked(deps.verificationEmailResender.resend).mockResolvedValue({ ok: false });
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Pending",
      lastName: "User",
      email: "pending@example.com",
      password: "supersecret",
      persona: "individual",
    });

    expect(result).toEqual({ ok: true, userId: "user-pending" });
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

  it("rejects entity invites when allowEntityInvites is false (org module hidden)", async () => {
    const deps = makeDeps();
    vi.mocked(deps.invitations.validateForRegistration).mockResolvedValue(
      ok({
        targetLegalEntityId: "le-1",
      } as never),
    );
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Org",
      lastName: "Invitee",
      email: "org@example.com",
      password: "supersecret",
      persona: "individual",
      inviteToken: "tok",
      allowEntityInvites: false,
    });

    expect(result).toEqual({
      ok: false,
      message: "Organisation invitations are not available yet",
      status: 403,
    });
    expect(deps.emailSignup.signUpEmail).not.toHaveBeenCalled();
  });

  it("allows platform invites even when allowEntityInvites is false", async () => {
    const deps = makeDeps();
    vi.mocked(deps.invitations.validateForRegistration).mockResolvedValue(
      ok({
        targetLegalEntityId: null,
      } as never),
    );
    const svc = makeService(deps);

    const result = await svc.register({
      firstName: "Staff",
      lastName: "Invitee",
      email: "staff2@example.com",
      password: "supersecret",
      persona: "individual",
      inviteToken: "tok",
      allowEntityInvites: false,
    });

    expect(result).toEqual({ ok: true, userId: "user-new" });
    expect(deps.invitations.consumeInviteForNewUser).toHaveBeenCalledWith(
      "tok",
      "user-new",
      "staff2@example.com",
    );
  });
});
