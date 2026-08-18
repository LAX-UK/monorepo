import { z } from "zod";

export const SOCKET_REVOCATION_CHANNEL_V1 = "identity:socket-revocation:v1" as const;

export const SOCKET_REVOCATION_REASONS_V1 = [
  "backchannel_logout",
  "session_revoked",
  "credential_change",
  "account_disabled",
  "identifier_recycled",
  "identity_merged",
] as const;

const socketRevocationPayloadSchemaV1 = z
  .object({
    version: z.literal(1),
    subject: z.string().min(1).max(512).optional(),
    sid: z.string().min(1).max(512).optional(),
    reason: z.enum(SOCKET_REVOCATION_REASONS_V1),
  })
  .strict()
  .refine((payload) => payload.subject !== undefined || payload.sid !== undefined);

export type SocketRevocationPayloadV1 = z.infer<typeof socketRevocationPayloadSchemaV1>;

export function parseSocketRevocationPayloadV1(value: unknown): SocketRevocationPayloadV1 | null {
  const parsed = socketRevocationPayloadSchemaV1.safeParse(value);
  return parsed.success ? parsed.data : null;
}
