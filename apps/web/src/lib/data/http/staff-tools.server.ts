import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { z } from "zod";

const staffToolsSchema = z.object({ tools: z.array(z.enum(["bid-admin", "lax-admin"])) });

export type StaffToolId = z.infer<typeof staffToolsSchema>["tools"][number];

/**
 * The staff tools the signed-in person can open, from the Bid API. Empty when the call fails:
 * the switcher then lists only the tool they are in, never one that might turn them away.
 */
export async function getServerMyStaffTools(): Promise<StaffToolId[]> {
  try {
    const res = await authedServerFetch("/admin/staff/my-tools", { cache: "no-store" });
    if (!res.ok) return [];
    const body: unknown = await res.json().catch(() => null);
    const data = body && typeof body === "object" && "data" in body ? body.data : null;
    const parsed = staffToolsSchema.safeParse(data);
    return parsed.success ? parsed.data.tools : [];
  } catch {
    return [];
  }
}
