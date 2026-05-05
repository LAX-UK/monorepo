import type {
  createAddressBodySchema,
  updateAddressBodySchema,
  updateProfileSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>;

export interface IProfileService {
  updateProfile(body: UpdateProfileBody): Promise<ServiceResult<Record<string, unknown>>>;
  createAddress(body: CreateAddressBody): Promise<ServiceResult<Record<string, unknown>>>;
  updateAddress(
    id: string,
    body: UpdateAddressBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  removeAddress(id: string): Promise<ServiceResult<void>>;
  setDefaultAddress(id: string): Promise<ServiceResult<Record<string, unknown>>>;
}
