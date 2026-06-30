"use server";

import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { firstZodErrorMessage } from "@/lib/forms/form-result";
import { LOT_FULFILMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  lotFulfilmentCollectBodySchema,
  lotFulfilmentReleaseBodySchema,
  lotFulfilmentShipBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const lotFulfilmentLotIdFormSchema = z.object({
  lotId: z.string().uuid(),
});

function adminLotFulfilmentQueuePath(returnStatus: string | undefined): string {
  const s = returnStatus?.trim();
  if (s) return `/admin/lot-fulfilment?status=${encodeURIComponent(s)}`;
  return "/admin/lot-fulfilment";
}

function lotFulfilmentQueueErrorUrl(returnStatus: string | undefined, message: string): string {
  const base = adminLotFulfilmentQueuePath(returnStatus);
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}error=${encodeURIComponent(message)}`;
}

function readLotFulfilmentReturnStatus(formData: FormData): string | undefined {
  const v = String(formData.get("returnStatus") ?? "").trim();
  return v || undefined;
}

async function assertLotFulfilmentAccess(returnStatus: string | undefined): Promise<void> {
  const denied = await assertAdminCapabilityForRedirect(LOT_FULFILMENT_ACCESS);
  if (!denied.ok) {
    redirect(lotFulfilmentQueueErrorUrl(returnStatus, denied.message));
  }
}

export async function adminLotFulfilmentReleaseAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentReleaseAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
      await assertLotFulfilmentAccess(returnStatus);
      const base = adminLotFulfilmentQueuePath(returnStatus);
      const lotParsed = lotFulfilmentLotIdFormSchema.safeParse({
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!lotParsed.success) {
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, "Invalid lot"));
      }
      const notesRaw = String(formData.get("notes") ?? "").trim();
      const bodyParsed = lotFulfilmentReleaseBodySchema.safeParse(
        notesRaw ? { notes: notesRaw } : {},
      );
      if (!bodyParsed.success) {
        redirect(
          lotFulfilmentQueueErrorUrl(
            returnStatus,
            firstZodErrorMessage(bodyParsed.error) ?? "Invalid notes",
          ),
        );
      }
      const res = await authedServerFetch(
        `/admin/lot-fulfilment/${encodeURIComponent(lotParsed.data.lotId)}/release`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyParsed.data),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, payload.error ?? "Release failed"));
      }
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      redirect(base);
    },
    { formData },
  );
}

export async function adminLotFulfilmentShipAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentShipAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
      await assertLotFulfilmentAccess(returnStatus);
      const base = adminLotFulfilmentQueuePath(returnStatus);
      const lotParsed = lotFulfilmentLotIdFormSchema.safeParse({
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!lotParsed.success) {
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, "Invalid lot"));
      }
      const bodyParsed = lotFulfilmentShipBodySchema.safeParse({
        carrier: String(formData.get("carrier") ?? "").trim(),
        trackingNumber: String(formData.get("trackingNumber") ?? "").trim(),
      });
      if (!bodyParsed.success) {
        redirect(
          lotFulfilmentQueueErrorUrl(
            returnStatus,
            firstZodErrorMessage(bodyParsed.error) ?? "Invalid ship form",
          ),
        );
      }
      const res = await authedServerFetch(
        `/admin/lot-fulfilment/${encodeURIComponent(lotParsed.data.lotId)}/ship`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyParsed.data),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, payload.error ?? "Ship update failed"));
      }
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      redirect(base);
    },
    { formData },
  );
}

export async function adminLotFulfilmentReadyForCollectionAction(
  formData: FormData,
): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentReadyForCollectionAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
      await assertLotFulfilmentAccess(returnStatus);
      const base = adminLotFulfilmentQueuePath(returnStatus);
      const lotParsed = lotFulfilmentLotIdFormSchema.safeParse({
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!lotParsed.success) {
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, "Invalid lot"));
      }
      const res = await authedServerFetch(
        `/admin/lot-fulfilment/${encodeURIComponent(lotParsed.data.lotId)}/ready-for-collection`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, payload.error ?? "Update failed"));
      }
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      redirect(base);
    },
    { formData },
  );
}

export async function adminLotFulfilmentDeliveredAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentDeliveredAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
      await assertLotFulfilmentAccess(returnStatus);
      const base = adminLotFulfilmentQueuePath(returnStatus);
      const lotParsed = lotFulfilmentLotIdFormSchema.safeParse({
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!lotParsed.success) {
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, "Invalid lot"));
      }
      const res = await authedServerFetch(
        `/admin/lot-fulfilment/${encodeURIComponent(lotParsed.data.lotId)}/delivered`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, payload.error ?? "Update failed"));
      }
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      redirect(base);
    },
    { formData },
  );
}

export async function adminLotFulfilmentCollectedAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentCollectedAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
      await assertLotFulfilmentAccess(returnStatus);
      const base = adminLotFulfilmentQueuePath(returnStatus);
      const lotParsed = lotFulfilmentLotIdFormSchema.safeParse({
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!lotParsed.success) {
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, "Invalid lot"));
      }
      const bodyParsed = lotFulfilmentCollectBodySchema.safeParse({
        collectedBy: String(formData.get("collectedBy") ?? "").trim(),
      });
      if (!bodyParsed.success) {
        redirect(
          lotFulfilmentQueueErrorUrl(
            returnStatus,
            firstZodErrorMessage(bodyParsed.error) ?? "Invalid form",
          ),
        );
      }
      const res = await authedServerFetch(
        `/admin/lot-fulfilment/${encodeURIComponent(lotParsed.data.lotId)}/collected`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyParsed.data),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(lotFulfilmentQueueErrorUrl(returnStatus, payload.error ?? "Update failed"));
      }
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      redirect(base);
    },
    { formData },
  );
}
