import {
  IDENTITY_EMAIL_REGISTRATION_PATH,
  emailRegistrationResultSchema,
} from "@auction/identity-contracts";
import type { LaxAccountDirectory } from "../../application/ports/guest-checkout.ports.js";
import type { IdentityMachineClient } from "../identity-machine-client.js";

/** Asks Identity, machine to machine, whether an email has a LAX account. Yes or no only. */
export function createHttpLaxAccountDirectory(
  identity: IdentityMachineClient,
): LaxAccountDirectory {
  return {
    async hasAccount(normalisedEmail) {
      const parsed = emailRegistrationResultSchema.safeParse(
        await identity.request("POST", IDENTITY_EMAIL_REGISTRATION_PATH, {
          email: normalisedEmail,
        }),
      );
      if (!parsed.success)
        throw new Error("Identity returned an invalid email registration answer");
      return parsed.data.registered;
    },
  };
}
