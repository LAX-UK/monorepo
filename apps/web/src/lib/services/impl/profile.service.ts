import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  CreateAddressBody,
  IProfileService,
  UpdateAddressBody,
  UpdateProfileBody,
} from "../interfaces/profile-service";

export class ProfileService implements IProfileService {
  constructor(private readonly api: IAuthedApiClient) {}

  async updateProfile(body: UpdateProfileBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async createAddress(body: CreateAddressBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async updateAddress(
    id: string,
    body: UpdateAddressBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/users/me/addresses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async removeAddress(id: string): Promise<ServiceResult<void>> {
    return this.api.json<void>(`/users/me/addresses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async setDefaultAddress(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/users/me/addresses/${encodeURIComponent(id)}/default`,
      { method: "POST" },
    );
  }
}
