import type { UpdateAddressInput } from "@auction/persistence/interfaces";
import { formatPhoneDisplay } from "@auction/validators";
import type { AddressService } from "../address.service.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IUserProfileHttpApplicationService } from "../interfaces/user-routes/user-profile-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { ProfileService } from "../profile.service.js";
import type { UiPreferenceService } from "../ui-preference.service.js";

export type UserProfileHttpDeps = {
  profileService: ProfileService;
  addressService: AddressService;
  uiPreferenceService: UiPreferenceService;
  mediaUrlResolver: IMediaUrlResolver;
};

export class UserProfileHttpApplicationService implements IUserProfileHttpApplicationService {
  constructor(private readonly deps: UserProfileHttpDeps) {}

  async updateProfile(input: {
    userId: string;
    body: Parameters<ProfileService["updateProfile"]>[1];
  }): Promise<UserHttpJson> {
    await this.deps.profileService.updateProfile(input.userId, input.body);
    return { status: 200, body: { ok: true } };
  }

  async listAddresses(input: { userId: string }): Promise<UserHttpJson> {
    const data = await this.deps.addressService.list(input.userId);
    return { status: 200, body: { data } };
  }

  async createAddress(input: {
    userId: string;
    body: Parameters<AddressService["create"]>[1];
  }): Promise<UserHttpJson> {
    const row = await this.deps.addressService.create(input.userId, input.body);
    return { status: 201, body: { data: row } };
  }

  async updateAddress(input: {
    userId: string;
    id: string;
    body: UpdateAddressInput;
  }): Promise<UserHttpJson> {
    const row = await this.deps.addressService.update(input.userId, input.id, input.body);
    if (!row) return { status: 404, body: { error: "Not found" } };
    return { status: 200, body: { data: row } };
  }

  async deleteAddress(input: { userId: string; id: string }): Promise<UserHttpJson> {
    const ok = await this.deps.addressService.delete(input.userId, input.id);
    if (!ok) return { status: 404, body: { error: "Not found" } };
    return { status: 204, body: null };
  }

  async setDefaultAddress(input: { userId: string; id: string }): Promise<UserHttpJson> {
    const existing = await this.deps.addressService.list(input.userId);
    if (!existing.some((a) => a.id === input.id)) {
      return { status: 404, body: { error: "Not found" } };
    }
    await this.deps.addressService.setDefault(input.userId, input.id);
    return { status: 200, body: { ok: true } };
  }

  async getMe(input: { userId: string }): Promise<UserHttpJson> {
    const [row, uiPrefs] = await Promise.all([
      this.deps.profileService.getProfile(input.userId),
      this.deps.uiPreferenceService.getForUser(input.userId),
    ]);
    if (!row) return { status: 404, body: { error: "User not found" } };
    const image = await this.deps.mediaUrlResolver.resolve(row.image);
    return {
      status: 200,
      body: {
        data: {
          id: row.id,
          email: row.email,
          name: row.name,
          mobile: row.mobile,
          mobileCountry: row.mobileCountry,
          phoneNumber: row.phoneNumber,
          phoneNumberVerified: row.phoneNumberVerified,
          mobileDisplay: formatPhoneDisplay(row.phoneNumber ?? row.mobile),
          role: row.role,
          staffRole: row.staffRole,
          image,
          emailVerified: row.emailVerified,
          emailStatus: row.emailStatus,
          emailStatusChangedAt: row.emailStatusChangedAt,
          pendingNewEmail: row.pendingNewEmail,
          hasSeenActingContextTooltip: row.hasSeenActingContextTooltip,
          kycStatus: row.kycStatus,
          signupPersona: row.signupPersona,
          deletionRequestedAt: row.deletionRequestedAt,
          twoFactorEnabled: row.twoFactorEnabled,
          securityStatusAvailable: row.securityStatusAvailable,
          suspended: row.suspended,
          uiPreferences: uiPrefs,
        },
      },
    };
  }
}
