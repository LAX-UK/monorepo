import type {
  IEmailSignupPersister,
  IRegistrationService,
  IRegistrationValidator,
  IUserProfilePersister,
  IWelcomeNotifier,
  RegistrationInput,
} from "./interfaces/registration.js";
import type { InvitationService } from "./invitation.service.js";

export class RegistrationService implements IRegistrationService {
  constructor(
    private readonly validator: IRegistrationValidator,
    private readonly emailSignup: IEmailSignupPersister,
    private readonly userProfile: IUserProfilePersister,
    private readonly welcome: IWelcomeNotifier,
    private readonly invitations: InvitationService,
  ) {}

  async register(input: RegistrationInput) {
    const v = this.validator.validate(input);
    if (!v.ok) {
      return { ok: false as const, message: v.message, status: 400 };
    }
    let validatedInvite: Awaited<ReturnType<InvitationService["validateForRegistration"]>> | null =
      null;
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
    const profile = await this.userProfile.setRegistrationProfile({
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
    });
    if (!profile.ok) {
      console.error("[registration] profile columns not persisted after signup", {
        userId: signup.userId,
        message: profile.message,
      });
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
