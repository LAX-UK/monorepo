"use server";

import { postBulkAction } from "@/lib/actions/admin/_shared/bulk-action";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
    const res = await authedServerFetch("/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Could not create invite", undefined, res.status);
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

export async function adminRevokeInvitationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRevokeInvitationAction",
    async () => {
      const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
      if (denied && !denied.ok) {
        redirect(`/admin/invitations?error=${encodeURIComponent(denied.error)}`);
      }
      const id = String(formData.get("invitationId") ?? "").trim();
      const p = invitationIdUuidParamSchema.safeParse({ invitationId: id });
      if (!p.success) {
        redirect(`/admin/invitations?error=${encodeURIComponent("Invalid invitation")}`);
      }
      const res = await authedServerFetch(`/admin/invitations/${p.data.invitationId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/invitations?error=${encodeURIComponent(payload.error ?? "Could not revoke")}`,
        );
      }
      revalidatePath("/admin/invitations");
      redirect("/admin/invitations");
    },
    { formData },
  );
}

export async function adminResendInvitationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminResendInvitationAction",
    async () => {
      const denied = await denyUnlessAdminCapability(INVITATIONS_ACCESS);
      if (denied && !denied.ok) {
        redirect(`/admin/invitations?error=${encodeURIComponent(denied.error)}`);
      }
      const id = String(formData.get("invitationId") ?? "").trim();
      const p = invitationIdUuidParamSchema.safeParse({ invitationId: id });
      if (!p.success) {
        redirect(`/admin/invitations?error=${encodeURIComponent("Invalid invitation")}`);
      }
      const res = await authedServerFetch(`/admin/invitations/${p.data.invitationId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/invitations?error=${encodeURIComponent(payload.error ?? "Could not resend")}`,
        );
      }
      revalidatePath("/admin/invitations");
      redirect("/admin/invitations");
    },
    { formData },
  );
}
