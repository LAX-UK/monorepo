import type {
  IEmailSignupPersister,
  IRegistrationService,
  IRegistrationValidator,
  IUserProfilePersister,
  IWelcomeNotifier,
  RegistrationInput,
} from "./interfaces/registration.js";

export class RegistrationService implements IRegistrationService {
  constructor(
    private readonly validator: IRegistrationValidator,
    private readonly emailSignup: IEmailSignupPersister,
    private readonly userProfile: IUserProfilePersister,
    private readonly welcome: IWelcomeNotifier,
  ) {}

  async register(input: RegistrationInput) {
    const v = this.validator.validate(input);
    if (!v.ok) {
      return { ok: false as const, message: v.message, status: 400 };
    }
    const displayName = `${input.firstName} ${input.lastName}`.trim();
    const signup = await this.emailSignup.signUpEmail({
      name: displayName,
      email: input.email,
      password: input.password,
    });
    if (!signup.ok) {
      return { ok: false as const, message: signup.message, status: signup.status ?? 400 };
    }
    const profile = await this.userProfile.setRegistrationProfile({
      userId: signup.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
    });
    if (!profile.ok) {
      console.error("[registration] profile columns not persisted after signup", {
        userId: signup.userId,
        message: profile.message,
      });
    }
    await this.welcome.notifyWelcome(signup.userId, input.email);
    return { ok: true as const, userId: signup.userId };
  }
}
