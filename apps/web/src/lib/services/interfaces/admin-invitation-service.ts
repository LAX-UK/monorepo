import type { adminCreateInvitationBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type AdminCreateInvitationBody = z.infer<typeof adminCreateInvitationBodySchema>;

export interface IAdminInvitationService {
  create(body: AdminCreateInvitationBody): Promise<ServiceResult<Record<string, unknown>>>;
  revoke(invitationId: string): Promise<ServiceResult<Record<string, unknown>>>;
  resend(invitationId: string): Promise<ServiceResult<Record<string, unknown>>>;
}
