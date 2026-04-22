import type { createAddressBodySchema, updateProfileSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;

export interface IProfileService {
  updateProfile(body: UpdateProfileBody): Promise<ServiceResult<Record<string, unknown>>>;
  createAddress(body: CreateAddressBody): Promise<ServiceResult<Record<string, unknown>>>;
}
