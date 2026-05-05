import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema>;
export type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema>;

export interface IAdminArtistService {
  create(input: CreateArtistInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateArtistInput): Promise<ServiceResult<Record<string, unknown>>>;
}
