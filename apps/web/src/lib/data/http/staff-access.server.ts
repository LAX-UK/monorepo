import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { laxStaffAccessProductSchema } from "@auction/types";
import { z } from "zod";

const summarySchema = z.object({
  subjectId: z.string(),
  platforms: z.array(z.object({ product: laxStaffAccessProductSchema, role: z.string() })),
  twoFactorEnabled: z.boolean().nullable(),
  lastSignInAt: z.string().nullable(),
});

const detailSchema = z.object({
  subjectId: z.string(),
  platforms: z.array(
    z.object({
      product: laxStaffAccessProductSchema,
      role: z.string().nullable(),
      updatedAt: z.string().nullable(),
      pending: z
        .object({
          action: z.enum(["granted", "revoked"]),
          role: z.string().nullable(),
          requestedAt: z.string(),
        })
        .nullable(),
    }),
  ),
  history: z.array(
    z.object({
      at: z.string(),
      product: laxStaffAccessProductSchema,
      action: z.enum(["granted", "revoked"]),
      role: z.string().nullable(),
      actorSubjectId: z.string(),
      actorName: z.string().nullable(),
      viaInvitation: z.boolean(),
    }),
  ),
});

export type StaffAccessSummary = z.infer<typeof summarySchema>;
export type StaffAccessDetail = z.infer<typeof detailSchema>;

async function readData<T>(res: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** Keyed by user id; empty when the viewer lacks directory access or the API is unavailable. */
export async function getServerStaffAccessSummaries(
  subjectIds: readonly string[],
): Promise<Record<string, StaffAccessSummary>> {
  if (subjectIds.length === 0) return {};
  const res = await authedServerFetch("/admin/staff/access/summaries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectIds }),
    cache: "no-store",
  });
  const summaries = await readData(res, z.array(summarySchema));
  return Object.fromEntries((summaries ?? []).map((s) => [s.subjectId, s]));
}

export async function getServerStaffAccessDetail(
  userId: string,
): Promise<StaffAccessDetail | null> {
  const res = await authedServerFetch(`/admin/staff/${encodeURIComponent(userId)}/access`, {
    cache: "no-store",
  });
  return readData(res, detailSchema);
}
