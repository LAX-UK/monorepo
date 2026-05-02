import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export class CompositeAuthenticator implements IAuthenticator {
  constructor(private readonly authenticators: readonly IAuthenticator[]) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    for (const authenticator of this.authenticators) {
      const user = await authenticator.getSessionUser(headers);
      if (user) return user;
    }
    return null;
  }
}
