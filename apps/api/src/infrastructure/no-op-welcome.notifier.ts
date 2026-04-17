import type { IWelcomeNotifier } from "../services/interfaces/registration.js";

export class NoOpWelcomeNotifier implements IWelcomeNotifier {
  async notifyWelcome(_userId: string, _email: string): Promise<void> {
    // Extend with email/push welcome without changing RegistrationService.
  }
}
