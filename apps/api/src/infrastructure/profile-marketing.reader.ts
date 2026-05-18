import type { IMarketingProfileReader } from "@auction/marketing-events";
import type { IProfileReader } from "../services/interfaces/profile.js";

export class ProfileMarketingReader implements IMarketingProfileReader {
  constructor(private readonly profiles: IProfileReader) {}

  async getProfile(userId: string) {
    const profile = await this.profiles.getProfile(userId);
    if (!profile) return null;
    return {
      email: profile.email,
      name: profile.name,
    };
  }
}
