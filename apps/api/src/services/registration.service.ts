import type {
  IRegistrationPersister,
  IRegistrationService,
  IRegistrationValidator,
  IWelcomeNotifier,
  RegistrationInput,
} from "./interfaces/registration.js";

export class RegistrationService implements IRegistrationService {
  constructor(
    private readonly validator: IRegistrationValidator,
    private readonly persister: IRegistrationPersister,
    private readonly welcome: IWelcomeNotifier,
  ) {}

  async register(input: RegistrationInput) {
    const v = this.validator.validate(input);
    if (!v.ok) {
      return { ok: false as const, message: v.message, status: 400 };
    }
    const p = await this.persister.register(input);
    if (!p.ok) {
      return { ok: false as const, message: p.message, status: p.status ?? 400 };
    }
    await this.welcome.notifyWelcome(p.userId, input.email);
    return { ok: true as const, userId: p.userId };
  }
}
