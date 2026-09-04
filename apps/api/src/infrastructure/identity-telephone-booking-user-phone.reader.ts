import type {
  ITelephoneBookingUserPhoneReader,
  TelephoneBookingUserPhoneRow,
} from "@auction/persistence/interfaces";
import type { IIdentitySecurityClient } from "../services/interfaces/identity-issuer-client.js";

export class IdentityTelephoneBookingUserPhoneReader implements ITelephoneBookingUserPhoneReader {
  constructor(private readonly identity: IIdentitySecurityClient) {}

  async findByUserId(userId: string): Promise<TelephoneBookingUserPhoneRow | null> {
    const security = await this.identity.readSecurityStatus(userId);
    if (!security) return null;
    return {
      phoneNumber: security.phoneNumber,
      phoneNumberVerified: security.phoneNumberVerified,
    };
  }
}
