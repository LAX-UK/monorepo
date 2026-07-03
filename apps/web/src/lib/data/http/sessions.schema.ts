import { toObjectRecord } from "@/lib/data/http/object-guards";
import type { UserSessionRow } from "@/lib/data/user-session-row";
import { z } from "zod";

export const userSessionRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): UserSessionRow => ({
    id: String(row.id ?? ""),
    createdAt: String(row.createdAt ?? ""),
    expiresAt: String(row.expiresAt ?? ""),
    ipAddress: row.ipAddress == null ? null : String(row.ipAddress),
    userAgent: row.userAgent == null ? null : String(row.userAgent),
    lastPasswordAuthAt: row.lastPasswordAuthAt == null ? null : String(row.lastPasswordAuthAt),
    isCurrent: Boolean(row.isCurrent),
  }),
) as z.ZodType<UserSessionRow>;
