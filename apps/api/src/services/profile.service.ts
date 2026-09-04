import type {
  IProfileReader,
  IProfileWriter,
  ProfileMeRow,
  ProfileUpdateInput,
} from "@auction/persistence/interfaces";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type {
  IIdentitySecurityClient,
  IdentitySecurityStatus,
} from "./interfaces/identity-issuer-client.js";

export type ProfileWithSecurityStatus = ProfileMeRow & {
  securityStatusAvailable: boolean;
};

export class ProfileService {
  constructor(
    private readonly reader: IProfileReader,
    private readonly writer: IProfileWriter,
    private readonly imageCleanup?: ImageCleanupService,
    private readonly identitySecurity?: IIdentitySecurityClient,
  ) {}

  async getProfile(userId: string): Promise<ProfileWithSecurityStatus | null> {
    const profile = await this.reader.getProfile(userId);
    if (!profile) return null;
    if (!this.identitySecurity) return { ...profile, securityStatusAvailable: false };
    let security: IdentitySecurityStatus | null;
    try {
      security = await this.identitySecurity.readSecurityStatus(userId);
    } catch {
      return { ...profile, securityStatusAvailable: false };
    }
    if (!security) return { ...profile, securityStatusAvailable: false };
    return {
      ...profile,
      securityStatusAvailable: true,
      phoneNumber: security.phoneNumber,
      phoneNumberVerified: security.phoneNumberVerified,
      pendingNewEmail: security.pendingNewEmail,
      twoFactorEnabled: security.twoFactorEnabled,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const previous = input.image !== undefined ? await this.reader.getProfile(userId) : null;
    await this.writer.updateProfile(userId, input);
    if (input.image !== undefined) {
      await this.imageCleanup?.enqueueRemoved(previous?.image ?? null, input.image ?? null);
    }
  }
}
