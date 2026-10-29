import type { ActionResult } from "@/lib/forms/form-result";

/**
 * The two role changes the staff record makes on one admin (ISP: nothing else). The roles
 * section and the add-role dialog take one, so they work the same for Bid admin and LAX Admin.
 */
export type StaffRoleActions<R extends string> = {
  assign(
    userId: string,
    body: { role: R; endsAt: string | null; reason: string },
  ): Promise<ActionResult<void>>;
  remove(userId: string, body: { role: R; reason: string }): Promise<ActionResult<void>>;
};
