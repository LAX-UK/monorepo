"use server";

import { assertSaleroomAccess } from "@/lib/actions/admin/_shared/saleroom-access";
import { redirectSaleroomError } from "@/lib/actions/admin/_shared/saleroom-redirect";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const saleroomSaleIdForm = z.object({
  saleId: z.string().uuid(),
});

const saleroomAdvanceForm = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
});

function saleroomActionError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return fallback;
}

export async function adminSaleroomGoLiveAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomGoLiveAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      }
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.goLive(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Go live failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomPauseAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomPauseAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.pause(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Pause failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomResumeAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomResumeAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.resume(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Resume failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomAdvanceAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomAdvanceAction",
    async () => {
      const parsed = saleroomAdvanceForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!parsed.success)
        redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid advance")}`);
      const { saleId, lotId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.advance(saleId, lotId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Advance failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomHammerAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomHammerAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.hammer(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Hammer failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomNoSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomNoSaleAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.noSale(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "No sale failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomCloseAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomCloseAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.close(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Close failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

const displayApproveForm = z.object({
  saleId: z.string().uuid(),
  userCode: z.string().trim().min(4).max(12),
});

const displayOverlayForm = z.object({
  saleId: z.string().uuid(),
  kind: z.enum(["fair_warning", "announcement"]),
  message: z.string().trim().max(500).optional(),
});

const displayRevokeForm = z.object({
  saleId: z.string().uuid(),
  pairingId: z.string().uuid(),
});

export async function adminSaleroomDisplayApproveAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomDisplayApproveAction",
    async () => {
      const parsed = displayApproveForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        userCode: String(formData.get("userCode") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid code")}`);
      const { saleId, userCode } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.displayApprove(saleId, userCode);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Display approve failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomDisplayOverlayAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomDisplayOverlayAction",
    async () => {
      const parsed = displayOverlayForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        kind: String(formData.get("kind") ?? "").trim(),
        message: String(formData.get("message") ?? "").trim() || undefined,
      });
      if (!parsed.success)
        redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid overlay")}`);
      const { saleId, kind, message } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.displayOverlay(saleId, kind, message);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Overlay failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomDisplayClearOverlayAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomDisplayClearOverlayAction",
    async () => {
      const parsed = saleroomSaleIdForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
      });
      if (!parsed.success) redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid sale")}`);
      const { saleId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.displayClearOverlay(saleId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Clear overlay failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}

export async function adminSaleroomDisplayRevokeAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSaleroomDisplayRevokeAction",
    async () => {
      const parsed = displayRevokeForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        pairingId: String(formData.get("pairingId") ?? "").trim(),
      });
      if (!parsed.success)
        redirect(`/admin/saleroom?error=${encodeURIComponent("Invalid revoke")}`);
      const { saleId, pairingId } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await getWriteContainer().adminSaleroom.displayRevoke(saleId, pairingId);
      if (!res.ok) {
        redirectSaleroomError(saleId, saleroomActionError(res.body, "Revoke failed"));
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}
