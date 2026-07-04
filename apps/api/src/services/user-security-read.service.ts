import type { IProfileReader } from "@auction/persistence";

export class UserSecurityReadService {
  constructor(private readonly profiles: IProfileReader) {}

  async getTwoFactorEnabled(userId: string): Promise<boolean | null> {
    const profile = await this.profiles.getProfile(userId);
    if (!profile) return null;
    return profile.twoFactorEnabled;
  }
}
