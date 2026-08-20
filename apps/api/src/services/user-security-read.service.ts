import type { IIdentitySecurityClient } from "./interfaces/identity-issuer-client.js";

export class UserSecurityReadService {
  constructor(private readonly identity: IIdentitySecurityClient) {}

  async getTwoFactorEnabled(userId: string): Promise<boolean | null> {
    return (await this.identity.readSecurityStatus(userId))?.twoFactorEnabled ?? null;
  }
}
