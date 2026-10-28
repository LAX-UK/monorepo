"use server";

import { revalidateAdminUserDetailPaths } from "@/lib/actions/admin/_shared/revalidate-paths";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { USER_ROLE_MANAGEMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { ServiceResult } from "@/lib/services/http/service-result";
import {
  type AdminAssignStaffRoleBody,
  type AdminRemoveStaffRoleBody,
  adminAssignStaffRoleBodySchema,
  adminRemoveStaffRoleBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

/** The API's failure as an action result, keeping its code (step-up or the role rule). */
function toActionResult(userId: string, result: ServiceResult<unknown>): ActionResult<void> {
  if (!result.ok) return actionFailure(result.message, undefined, result.status, result.code);
  revalidateAdminUserDetailPaths(userId);
  revalidatePath("/admin/staff/access");
  return actionSuccess();
}

async function run<S extends z.ZodTypeAny>(
  name: string,
  userId: string,
  schema: S,
  body: z.input<S>,
  call: (id: string, parsed: z.output<S>) => Promise<ServiceResult<unknown>>,
): Promise<ActionResult<void>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(USER_ROLE_MANAGEMENT_ACCESS);
    if (denied) return denied;
    const id = userId.trim();
    if (!id) return actionFailure("Missing staff member");
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    return toActionResult(id, await call(id, parsed.data));
  });
}

/** Gives a staff member one more Bid role, with an optional end date and a reason. */
export async function adminAssignStaffRoleAction(
  userId: string,
  body: AdminAssignStaffRoleBody,
): Promise<ActionResult<void>> {
  return run("adminAssignStaffRoleAction", userId, adminAssignStaffRoleBodySchema, body, (id, b) =>
    getWriteContainer().adminStaffRoles.assign(id, b),
  );
}

/** Ends one of a staff member's Bid roles now, with a reason. */
export async function adminRemoveStaffRoleAction(
  userId: string,
  body: AdminRemoveStaffRoleBody,
): Promise<ActionResult<void>> {
  return run("adminRemoveStaffRoleAction", userId, adminRemoveStaffRoleBodySchema, body, (id, b) =>
    getWriteContainer().adminStaffRoles.remove(id, b),
  );
}
