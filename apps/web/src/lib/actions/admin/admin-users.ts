"use server";

import { postBulkAction } from "@/lib/actions/admin/_shared/bulk-action";
import {
  revalidateAdminUserDetailPaths,
  revalidateAdminUserListPaths,
} from "@/lib/actions/admin/_shared/revalidate-paths";
import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import {
  SUBMISSIONS_ACCESS,
  USER_MODERATION_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminBulkSubmissionsBodySchema,
  adminBulkUsersBodySchema,
  adminPatchStaffRoleBodySchema,
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminSuspendUserAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSuspendUserAction",
    async () => {
      const denied = await denyUnlessAdminCapability(USER_MODERATION_ACCESS);
      if (denied && !denied.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(denied.error)}`);
      }
      const id = String(formData.get("userId") ?? "").trim();
      if (!id) redirect(`/admin/clients?error=${encodeURIComponent("Missing user")}`);
      const { adminUsers } = getWriteContainer();
      const r = await adminUsers.suspend(id, {
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });
      if (!r.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminUserDetailPaths(id);
      redirect("/admin/clients");
    },
    { formData },
  );
}

export async function adminUnsuspendUserAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminUnsuspendUserAction",
    async () => {
      const denied = await denyUnlessAdminCapability(USER_MODERATION_ACCESS);
      if (denied && !denied.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(denied.error)}`);
      }
      const id = String(formData.get("userId") ?? "").trim();
      if (!id) redirect(`/admin/clients?error=${encodeURIComponent("Missing user")}`);
      const { adminUsers } = getWriteContainer();
      const r = await adminUsers.unsuspend(id);
      if (!r.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminUserDetailPaths(id);
      redirect("/admin/clients");
    },
    { formData },
  );
}

export async function adminSetUserRoleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSetUserRoleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(USER_ROLE_MANAGEMENT_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("userId") ?? "").trim();
      const roleRaw = String(formData.get("role") ?? "").trim();
      const bodyParsed = adminSetRoleBodySchema.safeParse({ role: roleRaw });
      if (!id || !bodyParsed.success)
        redirect(`/admin/clients?error=${encodeURIComponent("Missing fields")}`);
      const { adminUsers } = getWriteContainer();
      const r = await adminUsers.setRole(id, bodyParsed.data);
      if (!r.ok) {
        redirect(`/admin/clients?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminUserListPaths();
      redirect(bodyParsed.data.role === "staff" ? "/admin/staff" : "/admin/clients");
    },
    { formData },
  );
}

export async function adminBulkUsersResultAction(
  body: z.infer<typeof adminBulkUsersBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkUsersResultAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_MODERATION_ACCESS);
    if (denied) return denied;
    const parsed = adminBulkUsersBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const result = await postBulkAction(
      "/admin/users/bulk",
      parsed.data,
      "User bulk action failed",
    );
    if (!result.ok) return result;
    revalidateAdminUserListPaths();
    return actionSuccess();
  });
}

export async function adminBulkSubmissionsResultAction(
  body: z.infer<typeof adminBulkSubmissionsBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkSubmissionsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const parsed = adminBulkSubmissionsBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const result = await postBulkAction(
      "/submissions/bulk",
      parsed.data,
      "Submission bulk action failed",
    );
    if (!result.ok) return result;
    revalidatePath("/admin/submissions");
    revalidatePath("/admin/lots");
    return actionSuccess();
  });
}

export async function adminSetUserStaffRoleResultAction(
  userId: string,
  body: z.infer<typeof adminPatchStaffRoleBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSetUserStaffRoleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_ROLE_MANAGEMENT_ACCESS);
    if (denied) return denied;
    const id = userId.trim();
    if (!id) {
      return actionFailure("Missing user");
    }
    const p = adminPatchStaffRoleBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const { adminUsers } = getWriteContainer();
    const r = await adminUsers.setStaffRole(id, p.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminUserDetailPaths(id);
    return actionSuccess();
  });
}

export async function adminSetUserRoleResultAction(
  userId: string,
  body: z.infer<typeof adminSetRoleBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSetUserRoleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_ROLE_MANAGEMENT_ACCESS);
    if (denied) return denied;
    const id = userId.trim();
    if (!id) {
      return actionFailure("Missing user");
    }
    const p = adminSetRoleBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const { adminUsers } = getWriteContainer();
    const r = await adminUsers.setRole(id, p.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminUserDetailPaths(id);
    return actionSuccess();
  });
}

export async function adminSuspendUserResultAction(
  userId: string,
  body: z.infer<typeof adminSuspendBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSuspendUserResultAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_MODERATION_ACCESS);
    if (denied) return denied;
    const id = userId.trim();
    if (!id) {
      return actionFailure("Missing user");
    }
    const p = adminSuspendBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const { adminUsers } = getWriteContainer();
    const r = await adminUsers.suspend(id, p.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminUserDetailPaths(id);
    return actionSuccess();
  });
}

export async function adminUnsuspendUserResultAction(userId: string): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUnsuspendUserResultAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_MODERATION_ACCESS);
    if (denied) return denied;
    const id = userId.trim();
    if (!id) {
      return actionFailure("Missing user");
    }
    const { adminUsers } = getWriteContainer();
    const r = await adminUsers.unsuspend(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminUserDetailPaths(id);
    return actionSuccess();
  });
}
