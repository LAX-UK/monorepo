import type { IIdentitySubjectClient } from "../services/interfaces/identity-issuer-client.js";
import type { IRegistrationCompensator } from "../services/interfaces/registration.js";

/** Deletes an orphaned issuer subject after product-profile persistence fails. */
export class IdentityRegistrationCompensator implements IRegistrationCompensator {
  constructor(private readonly identityIssuer: IIdentitySubjectClient) {}

  async deleteOrphanedUser(userId: string): Promise<{ ok: boolean }> {
    try {
      return { ok: await this.identityIssuer.deleteOrphanSubject(userId) };
    } catch (err) {
      console.error("[registration] compensating user delete failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false };
    }
  }
}
