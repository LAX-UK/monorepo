import type { UpdateAddressInput } from "@auction/persistence/interfaces";
import type { createAddressBodySchema, updateProfileSchema } from "@auction/validators";
import type { z } from "zod";
import type { UserHttpJson } from "./user-route-http.js";

type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface IUserProfileHttpApplicationService {
  updateProfile(input: { userId: string; body: UpdateProfileInput }): Promise<UserHttpJson>;

  listAddresses(input: { userId: string }): Promise<UserHttpJson>;

  createAddress(input: { userId: string; body: CreateAddressBody }): Promise<UserHttpJson>;

  updateAddress(input: {
    userId: string;
    id: string;
    body: UpdateAddressInput;
  }): Promise<UserHttpJson>;

  deleteAddress(input: { userId: string; id: string }): Promise<UserHttpJson>;

  setDefaultAddress(input: { userId: string; id: string }): Promise<UserHttpJson>;

  getMe(input: { userId: string }): Promise<UserHttpJson>;
}

export type { UpdateAddressInput };
