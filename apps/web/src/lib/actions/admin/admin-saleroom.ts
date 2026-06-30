"use server";

import { assertSaleroomAccess } from "@/lib/actions/admin/_shared/saleroom-access";
import { redirectSaleroomError } from "@/lib/actions/admin/_shared/saleroom-redirect";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/go-live`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Go live failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/pause`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Pause failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/resume`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Resume failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotId }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Advance failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/hammer`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Hammer failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/no-sale`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "No sale failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/close`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Close failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userCode: userCode.toUpperCase() }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Display approve failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/overlay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, ...(message ? { message } : {}) }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Overlay failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/overlay`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Clear overlay failed");
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairingId }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Revoke failed");
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
    },
    { formData },
  );
}
