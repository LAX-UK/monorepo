import type {
  IEmailSignupPersister,
  IExistingAccountReader,
  IRegistrationCompensator,
  IRegistrationService,
  IRegistrationValidator,
  IUserProfilePersister,
  IVerificationEmailResender,
  IWelcomeNotifier,
  RegistrationInput,
} from "./interfaces/registration.js";
import type { IInvitationConsumption } from "./invitation-consumption.service.js";

export class RegistrationService implements IRegistrationService {
  constructor(
    private readonly validator: IRegistrationValidator,
    private readonly existingAccountReader: IExistingAccountReader,
    private readonly verificationEmailResender: IVerificationEmailResender,
    private readonly emailSignup: IEmailSignupPersister,
    private readonly userProfile: IUserProfilePersister,
    private readonly welcome: IWelcomeNotifier,
    private readonly invitations: IInvitationConsumption,
    private readonly compensator: IRegistrationCompensator,
  ) {}

  async register(input: RegistrationInput) {
    const v = this.validator.validate(input);
    if (!v.ok) {
      return { ok: false as const, message: v.message, status: 400 };
    }
    let validatedInvite: Awaited<
      ReturnType<IInvitationConsumption["validateForRegistration"]>
    > | null = null;
    if (input.inviteToken) {
      validatedInvite = await this.invitations.validateForRegistration(
        input.inviteToken,
        input.email,
      );
      if (validatedInvite.isErr()) {
        return {
          ok: false as const,
          message: validatedInvite.error.message,
          status: validatedInvite.error.status as 400,
        };
      }
      if (validatedInvite.value.targetLegalEntityId != null && input.allowEntityInvites === false) {
        return {
          ok: false as const,
          message: "Organisation invitations are not available yet",
          status: 403,
        };
      }
    }

    const existing = await this.existingAccountReader.findByEmail(input.email);
    if (existing?.emailVerified === true) {
      return {
        ok: false as const,
        code: "email_already_registered",
        message: "This email is already registered. Sign in or reset your password.",
        status: 409,
      };
    }
    if (existing) {
      await this.verificationEmailResender.resend({
        email: input.email,
        persona: input.persona,
        ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      });
      return { ok: true as const, userId: existing.userId };
    }

    const displayName = `${input.firstName} ${input.lastName}`.trim();
    const signup = await this.emailSignup.signUpEmail({
      name: displayName,
      email: input.email,
      password: input.password,
      ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      persona: input.persona,
    });
    if (!signup.ok) {
      return { ok: false as const, message: signup.message, status: signup.status ?? 400 };
    }
    const profileInput = {
      userId: signup.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      persona: input.persona,
      ...(input.mobile !== undefined
        ? {
            mobile: input.mobile,
            ...(input.mobileCountry !== undefined ? { mobileCountry: input.mobileCountry } : {}),
          }
        : {}),
    };
    let profile = await this.userProfile.setRegistrationProfile(profileInput);
    if (!profile.ok) {
      // One retry: a transient DB blip is the realistic cause and avoids the compensating delete.
      profile = await this.userProfile.setRegistrationProfile(profileInput);
    }
    if (!profile.ok) {
      console.error("[registration] profile columns not persisted after signup", {
        userId: signup.userId,
        message: profile.message,
      });
      // Compensate so the email is reusable instead of orphaned ("already registered").
      const compensated = await this.compensator.deleteOrphanedUser(signup.userId);
      if (!compensated.ok) {
        console.error("[registration] orphaned auth user left behind after failed compensation", {
          userId: signup.userId,
        });
      }
      return {
        ok: false as const,
        message: "Registration could not be completed. Please try again.",
        status: 500,
      };
    }
    if (input.inviteToken && validatedInvite?.isOk()) {
      if (validatedInvite.value.targetLegalEntityId == null) {
        const consumed = await this.invitations.consumeInviteForNewUser(
          input.inviteToken,
          signup.userId,
          input.email,
        );
        if (consumed.isErr()) {
          return {
            ok: false as const,
            message: consumed.error.message,
            status: consumed.error.status as 400,
          };
        }
      }
    }
    await this.welcome.notifyWelcome(signup.userId, input.email);
    return { ok: true as const, userId: signup.userId };
  }
}
