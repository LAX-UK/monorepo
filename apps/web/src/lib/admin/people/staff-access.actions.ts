"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";

export type StaffAccessActionResult = { ok: true } | { ok: false; error: string };

async function failure(res: Response): Promise<StaffAccessActionResult> {
  if (res.status === 403) return { ok: false, error: "You don't have permission to change this." };
  const body: unknown = await res.json().catch(() => null);
  const message =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : null;
  if (message === "cannot_revoke_self") {
    return { ok: false, error: "You can't remove your own access." };
  }
  return { ok: false, error: "We couldn't save this change. Try again." };
}

function accessPath(userId: string): string {
  return `/admin/staff/${encodeURIComponent(userId)}/access/shop`;
}

export async function setShopStaffRoleAction(
  userId: string,
  role: string,
): Promise<StaffAccessActionResult> {
  return instrumentServerAction("setShopStaffRoleAction", async () => {
    const res = await authedServerFetch(accessPath(userId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return failure(res);
    revalidatePath(`/admin/staff/${userId}`);
    return { ok: true };
  });
}

export async function revokeShopStaffAccessAction(
  userId: string,
): Promise<StaffAccessActionResult> {
  return instrumentServerAction("revokeShopStaffAccessAction", async () => {
    const res = await authedServerFetch(accessPath(userId), { method: "DELETE" });
    if (!res.ok) return failure(res);
    revalidatePath(`/admin/staff/${userId}`);
    return { ok: true };
  });
}
