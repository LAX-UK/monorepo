import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import type { UserRole, UserStaffRole } from "@auction/types";

export type InvitePreview = {
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  expiresAt: string;
  entityScoped: boolean;
};

export type InvitePreviewResult =
  | { ok: true; preview: InvitePreview }
  | { ok: false; reason: "invalid" | "expired" | "unavailable" };

/** Server-side preview of an invitation token (public endpoint, no auth).
 * Distinguishes "bad token" from "preview service down" so the register page
 * can fail open instead of dead-ending a valid invite. */
export async function fetchInvitePreview(token: string): Promise<InvitePreviewResult> {
  try {
    const res = await fetch(
      `${getServerApiBase()}/invitations/preview?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const body = (await res.json()) as { data?: InvitePreview };
      if (body.data?.email) {
        return { ok: true, preview: body.data };
      }
      return { ok: false, reason: "unavailable" };
    }
    if (res.status === 404) return { ok: false, reason: "invalid" };
    if (res.status === 400) return { ok: false, reason: "expired" };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
