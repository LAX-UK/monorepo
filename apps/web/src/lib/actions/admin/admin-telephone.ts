"use server";

import { assertSaleroomAccess } from "@/lib/actions/admin/_shared/saleroom-access";
import { redirectSaleroomError } from "@/lib/actions/admin/_shared/saleroom-redirect";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const telephoneBookingActionForm = z.object({
  saleId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

const telephoneAssignClerkForm = telephoneBookingActionForm.extend({
  clerkUserId: z.string().min(1).max(191),
});

const telephoneNotesForm = telephoneBookingActionForm.extend({
  notes: z.string().max(2000),
});

const telephoneCancelForm = telephoneBookingActionForm.extend({
  reason: z.string().max(500).optional(),
});

const telephoneStartLineForm = telephoneBookingActionForm.extend({
  lotId: z.string().uuid(),
});

const telephonePlaceBidForm = z.object({
  lotId: z.string().uuid(),
  buyerUserId: z.string().min(1).max(191),
  buyerLegalEntityId: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  maxAutoBidAmount: z.coerce.number().finite().positive().optional(),
  telephoneBookingId: z.string().uuid().optional(),
});

function redirectTelephoneBookingError(saleId: string, message: string): never {
  redirect(
    `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings?error=${encodeURIComponent(message)}`,
  );
}

async function postTelephoneBookingAction(
  saleId: string,
  bookingId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  await assertSaleroomAccess(saleId);
  return authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings/${encodeURIComponent(bookingId)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
  );
}

function revalidateTelephoneBookingPaths(saleId: string) {
  revalidatePath(`/admin/sales/${saleId}/telephone-bookings`);
  revalidatePath(`/admin/sales/${saleId}/operations`);
  revalidatePath(`/admin/saleroom/${saleId}`);
  revalidateAdminSaleDetail(saleId);
}

export async function adminTelephoneBookingConfirmAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingConfirmAction",
    async () => {
      const parsed = telephoneBookingActionForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid booking");
      const { saleId, bookingId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "confirm");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Confirm failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingAssignClerkAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingAssignClerkAction",
    async () => {
      const parsed = telephoneAssignClerkForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
        clerkUserId: String(formData.get("clerkUserId") ?? "").trim(),
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid clerk assignment");
      const { saleId, bookingId, clerkUserId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "assign-clerk", {
        clerkUserId,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Assign clerk failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingApproveLimitIncreaseAction(
  formData: FormData,
): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingApproveLimitIncreaseAction",
    async () => {
      const parsed = telephoneBookingActionForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid booking");
      const { saleId, bookingId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "approve-limit-increase");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Approve limit failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingStartLineAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingStartLineAction",
    async () => {
      const parsed = telephoneStartLineForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!parsed.success) redirectSaleroomError("", "Invalid start line");
      const { saleId, bookingId, lotId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "start-line", { lotId });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Start line failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingCompleteLineAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingCompleteLineAction",
    async () => {
      const parsed = telephoneStartLineForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
        lotId: String(formData.get("lotId") ?? "").trim(),
      });
      if (!parsed.success) redirectSaleroomError("", "Invalid complete line");
      const { saleId, bookingId, lotId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "complete-line", { lotId });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Complete line failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingCloseAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingCloseAction",
    async () => {
      const parsed = telephoneBookingActionForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid booking");
      const { saleId, bookingId } = parsed.data;
      const res = await postTelephoneBookingAction(saleId, bookingId, "close");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Close failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingCancelAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingCancelAction",
    async () => {
      const parsed = telephoneCancelForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid booking");
      const { saleId, bookingId, reason } = parsed.data;
      const res = await postTelephoneBookingAction(
        saleId,
        bookingId,
        "cancel",
        reason ? { reason } : {},
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Cancel failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephoneBookingNotesAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminTelephoneBookingNotesAction",
    async () => {
      const parsed = telephoneNotesForm.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        bookingId: String(formData.get("bookingId") ?? "").trim(),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!parsed.success) redirectTelephoneBookingError("", "Invalid notes");
      const { saleId, bookingId, notes } = parsed.data;
      await assertSaleroomAccess(saleId);
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings/${encodeURIComponent(bookingId)}/notes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectTelephoneBookingError(saleId, payload.error ?? "Save notes failed");
      }
      revalidateTelephoneBookingPaths(saleId);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings`);
    },
    { formData },
  );
}

export async function adminTelephonePlaceBidResultAction(
  input: unknown,
): Promise<ActionResult<{ bidId: string }>> {
  return instrumentServerAction("adminTelephonePlaceBidResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = telephonePlaceBidForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const body = parsed.data;
    const res = await authedServerFetch("/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: body.lotId,
        buyerUserId: body.buyerUserId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        amount: body.amount,
        ...(body.maxAutoBidAmount != null ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        ...(body.telephoneBookingId ? { telephoneBookingId: body.telephoneBookingId } : {}),
      }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Telephone bid failed");
    }

    const json = (await res.json()) as { data?: { id?: string } };
    const bidId = json.data?.id;
    if (!bidId) return actionFailure("Unexpected response from server");
    return actionSuccess({ bidId });
  });
}
