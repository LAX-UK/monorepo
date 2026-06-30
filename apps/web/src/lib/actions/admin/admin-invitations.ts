"use server";

import { postBulkAction } from "@/lib/actions/admin/_shared/bulk-action";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { INVITATIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminBulkInvitationsBodySchema,
  adminCreateInvitationBodySchema,
  invitationIdUuidParamSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminBulkInvitationsResultAction(
  body: z.infer<typeof adminBulkInvitationsBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkInvitationsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
    if (denied) return denied;
    const parsed = adminBulkInvitationsBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const result = await postBulkAction(
      "/admin/invitations/bulk",
      parsed.data,
      "Invitation bulk action failed",
    );
    if (!result.ok) return result;
    revalidatePath("/admin/invitations");
    return actionSuccess();
  });
}

export async function adminCreateInvitationResultAction(
  values: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCreateInvitationResultAction", async () => {
    const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
    if (denied) return denied;
    const parsed = adminCreateInvitationBodySchema.safeParse(values);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const r = await getWriteContainer().invitations.create(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/invitations");
    return actionSuccess();
  });
}

export async function adminCreateInvitationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCreateInvitationAction",
    async () => {
      const r = await adminCreateInvitationResultAction({
        email: String(formData.get("email") ?? "").trim(),
        targetRole: String(formData.get("targetRole") ?? "").trim(),
      });
      if (!r.ok) {
        redirect(`/admin/invitations?error=${encodeURIComponent(r.error)}`);
      }
      redirect("/admin/invitations");
    },
    { formData },
  );
}

export async function adminRevokeInvitationResultAction(
  invitationId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRevokeInvitationResultAction", async () => {
    const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
    if (denied) return denied;
    const p = invitationIdUuidParamSchema.safeParse({ invitationId });
    if (!p.success) {
      return actionFailure("Invalid invitation", zodErrorToFieldErrors(p.error));
    }
    const r = await getWriteContainer().invitations.revoke(p.data.invitationId);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/invitations");
    return actionSuccess();
  });
}

export async function adminRevokeInvitationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRevokeInvitationAction",
    async () => {
      const id = String(formData.get("invitationId") ?? "").trim();
      const r = await adminRevokeInvitationResultAction(id);
      if (!r.ok) {
        redirect(`/admin/invitations?error=${encodeURIComponent(r.error)}`);
      }
      redirect("/admin/invitations");
    },
    { formData },
  );
}

export async function adminResendInvitationResultAction(
  invitationId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminResendInvitationResultAction", async () => {
    const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
    if (denied) return denied;
    const p = invitationIdUuidParamSchema.safeParse({ invitationId });
    if (!p.success) {
      return actionFailure("Invalid invitation", zodErrorToFieldErrors(p.error));
    }
    const r = await getWriteContainer().invitations.resend(p.data.invitationId);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/invitations");
    return actionSuccess();
  });
}

export async function adminResendInvitationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminResendInvitationAction",
    async () => {
      const id = String(formData.get("invitationId") ?? "").trim();
      const r = await adminResendInvitationResultAction(id);
      if (!r.ok) {
        redirect(`/admin/invitations?error=${encodeURIComponent(r.error)}`);
      }
      redirect("/admin/invitations");
    },
    { formData },
  );
}
