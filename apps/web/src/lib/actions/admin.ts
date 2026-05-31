"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import {
  getIdempotentCategoryCreate,
  getIdempotentLotCreate,
  getIdempotentLotPublish,
  setIdempotentCategoryCreate,
  setIdempotentLotCreate,
  setIdempotentLotPublish,
} from "@/lib/actions/idempotency-cache";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import {
  type BulkLotsActionResult,
  bulkLotsFailureMessage,
  parseBulkLotsApiResponse,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { CATEGORIES_ACCESS, LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { CapabilityRequirement, Lot } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  adminBulkInvitationsBodySchema,
  adminBulkSubmissionsBodySchema,
  adminBulkUsersBodySchema,
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminCreateInvitationBodySchema,
  adminPatchStaffRoleBodySchema,
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  artistDeleteBodySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  invitationIdUuidParamSchema,
  lotFulfilmentCollectBodySchema,
  lotFulfilmentReleaseBodySchema,
  lotFulfilmentShipBodySchema,
  returnLotToInventoryBodySchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const AUCTION_MANAGE_ACCESS: CapabilityRequirement = SALES_ACCESS;

const ARTIST_WRITE_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "artist.review", "artist.merge", "platform.admin.full"],
};

const ARTIST_REVIEW_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.review", "platform.admin.full"],
};

const ARTIST_MERGE_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.merge", "platform.admin.full"],
};

const ARTIST_DELETE_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.delete", "platform.admin.full"],
};

function revalidateAdminUserListPaths(): void {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/staff");
}

function revalidateAdminUserDetailPaths(userId: string): void {
  revalidateAdminUserListPaths();
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath(`/admin/staff/${userId}`);
}

function revalidateAdminLotDetail(lotId: string): void {
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${lotId}`);
  revalidatePath(`/admin/lots/${lotId}/images`);
  revalidatePath(`/admin/lots/${lotId}/documents`);
  revalidatePath(`/admin/lots/${lotId}/bids`);
  revalidatePath(`/admin/lots/${lotId}/edit`);
  revalidatePath(`/admin/lots/${lotId}/edit/catalog`);
  revalidatePath(`/admin/lots/${lotId}/edit/documents`);
}

function revalidateAdminCategoryDetail(categoryId: string): void {
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath(`/admin/categories/${categoryId}/edit`);
  revalidatePath(`/admin/categories/${categoryId}/children`);
  revalidatePath(`/admin/categories/${categoryId}/lots`);
}

async function postBulkAction(
  path: string,
  body: unknown,
  fallback: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(payload.error ?? fallback, undefined, res.status);
  }
  return actionSuccess();
}

export async function adminBulkLotsAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminBulkLotsAction",
    async () => {
      const raw = String(formData.get("payload") ?? "").trim();
      let obj: unknown;
      try {
        obj = JSON.parse(raw) as unknown;
      } catch {
        redirect(`/admin/lots?error=${encodeURIComponent("Invalid bulk payload")}`);
      }
      const parsed = bulkLotsBodySchema.safeParse(obj);
      if (!parsed.success) {
        redirect(`/admin/lots?error=${encodeURIComponent("Invalid bulk payload")}`);
      }
      const access = parsed.data.op === "cancel" ? SALES_ACCESS : LOTS_ACCESS;
      const denied = await assertAdminCapabilityForRedirect(access);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.bulk(parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/lots");
      redirect("/admin/lots");
    },
    { formData },
  );
}

export async function adminPublishLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminPublishLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const { adminLots } = getWriteContainer();
      const r = await adminLots.publish(id);
      if (!r.ok) {
        const q = new URLSearchParams({ error: r.message });
        if (r.code) q.set("error_code", r.code);
        redirect(`/admin/lots/${id}?${q.toString()}`);
      }
      revalidateAdminLotDetail(id);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

export async function adminCancelLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCancelLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const body = cancelLotBodySchema.safeParse({
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });
      if (!body.success) {
        redirect(`/admin/lots/${id}?error=${encodeURIComponent("Invalid cancel form")}`);
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.cancel(id, body.data);
      if (!r.ok) {
        redirect(`/admin/lots/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminLotDetail(id);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

export async function adminRefundPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRefundPaymentAction",
    async () => {
      const id = String(formData.get("paymentId") ?? "").trim();
      if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
      const { adminPayments } = getWriteContainer();
      const r = await adminPayments.refund(id);
      if (!r.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/payments");
      redirect("/admin/payments");
    },
    { formData },
  );
}

export async function adminCapturePaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCapturePaymentAction",
    async () => {
      const id = String(formData.get("paymentId") ?? "").trim();
      if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
      const { adminPayments } = getWriteContainer();
      const r = await adminPayments.capture(id);
      if (!r.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/payments");
      redirect("/admin/payments");
    },
    { formData },
  );
}

export async function adminSuspendUserAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminSuspendUserAction",
    async () => {
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

export async function adminCreateLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCreateLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots/new?error=${encodeURIComponent(denied.message)}`);
      }
      const startRaw = String(formData.get("startTime") ?? "");
      const endRaw = String(formData.get("endTime") ?? "");
      const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();
      const parsed = createLotSchema.safeParse({
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        medium: String(formData.get("medium") ?? "").trim() || undefined,
        dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
        sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
        categoryId: String(formData.get("categoryId") ?? "").trim(),
        auctionType: String(formData.get("auctionType") ?? "english"),
        startingPrice: String(formData.get("startingPrice") ?? "").trim(),
        reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
        buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
        dutchDecrementAmount:
          String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
        dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
        startTime: instantFromDatetimeFormString(startRaw),
        endTime: instantFromDatetimeFormString(endRaw),
      });
      if (!parsed.success) {
        redirect(
          `/admin/lots/new?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
        );
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.create(parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots/new?error=${encodeURIComponent(r.message)}`);
      }
      const newId = r.data.id;
      revalidatePath("/admin/lots");
      redirect(`/admin/lots/${newId}`);
    },
    { formData },
  );
}

export async function adminUpdateLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminUpdateLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const startRaw = String(formData.get("startTime") ?? "");
      const endRaw = String(formData.get("endTime") ?? "");
      const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();
      const parsed = updateLotSchema.safeParse({
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        medium: String(formData.get("medium") ?? "").trim() || undefined,
        dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
        sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
        categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
        auctionType: String(formData.get("auctionType") ?? "").trim() || undefined,
        startingPrice: String(formData.get("startingPrice") ?? "").trim() || undefined,
        reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
        buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
        dutchDecrementAmount:
          String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
        dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
        startTime: startRaw ? instantFromDatetimeFormString(startRaw) : undefined,
        endTime: endRaw ? instantFromDatetimeFormString(endRaw) : undefined,
      });
      if (!parsed.success) {
        redirect(
          `/admin/lots/${id}/edit?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
        );
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.update(id, parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots/${id}/edit?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/lots");
      revalidatePath(`/admin/lots/${id}`);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

export async function adminCreateLotResultAction(
  input: z.infer<typeof createLotSchema>,
  idempotencyKey?: string,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const cachedId = getIdempotentLotCreate(idempotencyKey);
    if (cachedId) return actionSuccess({ id: cachedId });
    const parsed = createLotSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    if (parsed.data == null) {
      return actionFailure("Invalid lot payload");
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.create(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    setIdempotentLotCreate(idempotencyKey, r.data.id);
    revalidatePath("/admin/lots");
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminCreateCategoryResultAction(
  input: z.infer<typeof adminCreateCategoryBodySchema>,
  idempotencyKey?: string,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateCategoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CATEGORIES_ACCESS);
    if (denied) return denied;
    const cachedId = getIdempotentCategoryCreate(idempotencyKey);
    if (cachedId) return actionSuccess({ id: cachedId });
    const parsed = adminCreateCategoryBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminCategories } = getWriteContainer();
    const r = await adminCategories.create(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    setIdempotentCategoryCreate(idempotencyKey, r.data.id);
    revalidatePath("/admin/categories");
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminUpdateCategoryResultAction(
  categoryId: string,
  input: z.infer<typeof adminUpdateCategoryBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateCategoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CATEGORIES_ACCESS);
    if (denied) return denied;
    const id = categoryId.trim();
    if (!id) return actionFailure("Missing category");
    const parsed = adminUpdateCategoryBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminCategories } = getWriteContainer();
    const r = await adminCategories.update(id, parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminCategoryDetail(id);
    return actionSuccess();
  });
}

export async function adminArchiveCategoryResultAction(
  categoryId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminArchiveCategoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CATEGORIES_ACCESS);
    if (denied) return denied;
    const id = categoryId.trim();
    if (!id) return actionFailure("Missing category");
    const { adminCategories } = getWriteContainer();
    const r = await adminCategories.archive(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminCategoryDetail(id);
    return actionSuccess();
  });
}

export async function adminDeleteCategoryResultAction(
  categoryId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDeleteCategoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CATEGORIES_ACCESS);
    if (denied) return denied;
    const id = categoryId.trim();
    if (!id) return actionFailure("Missing category");
    const { adminCategories } = getWriteContainer();
    const r = await adminCategories.delete(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/categories");
    return actionSuccess();
  });
}

export async function adminCreateArtistResultAction(
  input: z.infer<typeof adminCreateArtistBodySchema>,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateArtistResultAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTIST_WRITE_ACCESS);
    if (denied) return denied;
    const parsed = adminCreateArtistBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminArtists } = getWriteContainer();
    const r = await adminArtists.create(parsed.data);
    if (!r.ok) return actionFailure(r.message, undefined, r.status);
    revalidatePath("/admin/artists");
    return actionSuccess({ id: r.data.id });
  });
}

const mergeArtistPhraseSchema = z.object({
  intoArtistId: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
  confirmationPhrase: z.string().min(1).max(500),
});

export async function adminReviewArtistResultAction(
  artistId: string,
  input: { decision: "approved" | "rejected"; reviewNotes?: string; rejectionReason?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminReviewArtistResultAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTIST_REVIEW_ACCESS);
    if (denied) return denied;
    const res = await authedServerFetch(`/artists/${encodeURIComponent(artistId)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      return actionFailure(
        payload.error ?? payload.message ?? "Could not submit review",
        undefined,
        res.status,
      );
    }
    revalidatePath(`/admin/artists/${artistId}`);
    revalidatePath("/admin/artists");
    return actionSuccess();
  });
}

export async function adminMergeArtistResultAction(
  fromArtistId: string,
  input: z.infer<typeof mergeArtistPhraseSchema>,
): Promise<ActionResult<{ remainingId: string }>> {
  return instrumentServerAction("adminMergeArtistResultAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTIST_MERGE_ACCESS);
    if (denied) return denied;
    const fromId = fromArtistId.trim();
    if (!fromId) return actionFailure("Missing artist");

    const parsed = mergeArtistPhraseSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    if (parsed.data.intoArtistId === fromId) {
      return actionFailure("Cannot merge an artist into itself");
    }

    const canonRes = await authedServerFetch(
      `/artists/${encodeURIComponent(parsed.data.intoArtistId)}`,
    );
    if (!canonRes.ok) {
      return actionFailure("Target artist not found", undefined, canonRes.status);
    }
    const canonBody = (await canonRes.json()) as { data?: { displayName?: string } };
    const displayName = canonBody.data?.displayName;
    if (!displayName) {
      return actionFailure("Target artist not found");
    }
    const expected = `MERGE INTO ${displayName}`;
    if (parsed.data.confirmationPhrase !== expected) {
      return actionFailure("Confirmation phrase does not match — type it exactly as shown.");
    }

    const mergeRes = await authedServerFetch(`/artists/${encodeURIComponent(fromId)}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intoArtistId: parsed.data.intoArtistId,
        reason: parsed.data.reason,
        confirmationPhrase: parsed.data.confirmationPhrase,
      }),
    });
    if (!mergeRes.ok) {
      const payload = (await mergeRes.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      return actionFailure(
        payload.message ?? payload.error ?? "merge_failed",
        undefined,
        mergeRes.status,
      );
    }

    const body = (await mergeRes.json()) as {
      data?: { remaining?: { id?: string }; canonical?: { id?: string } };
    };
    const remainingId =
      body.data?.remaining?.id ?? body.data?.canonical?.id ?? parsed.data.intoArtistId;

    revalidatePath("/admin/artists");
    revalidatePath(`/admin/artists/${fromId}/edit`);
    revalidatePath(`/admin/artists/${remainingId}/edit`);
    return actionSuccess({ remainingId });
  });
}

export async function adminDeleteArtistResultAction(
  artistId: string,
  input: z.infer<typeof artistDeleteBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDeleteArtistResultAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTIST_DELETE_ACCESS);
    if (denied) return denied;
    const id = artistId.trim();
    if (!id) return actionFailure("Missing artist");

    const parsed = artistDeleteBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }

    const res = await authedServerFetch(`/artists/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        blockers?: string[];
      };
      const message = payload.blockers?.[0] ?? payload.message ?? payload.error ?? "Delete failed";
      return actionFailure(message, undefined, res.status);
    }

    revalidatePath("/admin/artists");
    revalidatePath(`/admin/artists/${id}`);
    revalidatePath(`/admin/artists/${id}/edit`);
    return actionSuccess();
  });
}

export async function adminUpdateArtistResultAction(
  artistId: string,
  input: z.infer<typeof adminUpdateArtistBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateArtistResultAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTIST_WRITE_ACCESS);
    if (denied) return denied;
    const id = artistId.trim();
    if (!id) return actionFailure("Missing artist");
    const parsed = adminUpdateArtistBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminArtists } = getWriteContainer();
    const r = await adminArtists.update(id, parsed.data);
    if (!r.ok) return actionFailure(r.message, undefined, r.status);
    revalidatePath("/admin/artists");
    revalidatePath(`/admin/artists/${id}/edit`);
    return actionSuccess();
  });
}

export async function adminUpdateLotMarketingDetailsResultAction(
  lotId: string,
  input: z.infer<typeof updateLotMarketingDetailsSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateLotMarketingDetailsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const parsed = updateLotMarketingDetailsSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.updateMarketingDetails(id, parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    revalidatePath("/", "layout");
    return actionSuccess();
  });
}

export async function adminGetLotAttachPreviewAction(lotId: string): Promise<ActionResult<Lot>> {
  return instrumentServerAction("adminGetLotAttachPreviewAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const lot = await getAdminLotById(id).catch(() => null);
    if (!lot) {
      return actionFailure("Lot not found", undefined, 404);
    }
    if (lot.status !== "draft") {
      return actionFailure("Only draft lots can be attached");
    }
    if (lot.saleId != null) {
      return actionFailure("Lot already belongs to a sale");
    }
    return actionSuccess(lot);
  });
}

export async function adminUpdateLotResultAction(
  lotId: string,
  input: z.infer<typeof updateLotSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const parsed = updateLotSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    if (parsed.data == null) {
      return actionFailure("Invalid update payload");
    }
    const existing = await getAdminLotById(id).catch(() => null);
    const previousSaleId = existing?.saleId ?? null;
    const { adminLots } = getWriteContainer();
    const r = await adminLots.update(id, parsed.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    const newSaleId =
      parsed.data.saleId !== undefined ? (parsed.data.saleId ?? null) : previousSaleId;
    revalidateAdminLotDetail(id);
    revalidatePath("/admin/sales");
    if (previousSaleId) {
      revalidatePath(`/admin/sales/${previousSaleId}`);
    }
    if (newSaleId && newSaleId !== previousSaleId) {
      revalidatePath(`/admin/sales/${newSaleId}`);
    }
    return actionSuccess();
  });
}

export async function adminPublishLotResultAction(
  lotId: string,
  idempotencyKey?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminPublishLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    if (getIdempotentLotPublish(id, idempotencyKey)) {
      return actionSuccess();
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.publish(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status, r.code);
    }
    setIdempotentLotPublish(id, idempotencyKey);
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminCancelLotResultAction(
  lotId: string,
  body: z.infer<typeof cancelLotBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCancelLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(AUCTION_MANAGE_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const p = cancelLotBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.cancel(id, p.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminSoftDeleteLotResultAction(
  lotId: string,
  confirmationPhrase: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSoftDeleteLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(AUCTION_MANAGE_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    const phrase = confirmationPhrase.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    if (!phrase) {
      return actionFailure("Confirmation phrase is required");
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.softDelete(id, phrase);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminReturnLotToInventoryResultAction(
  lotId: string,
  body: z.infer<typeof returnLotToInventoryBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminReturnLotToInventoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(AUCTION_MANAGE_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const p = returnLotToInventoryBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const lotBefore = await getAdminLotById(id);
    const { adminLots } = getWriteContainer();
    const r = await adminLots.returnToInventory(id, p.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, meta?.code as string | undefined);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    if (lotBefore?.saleId) {
      revalidateAdminSaleDetail(lotBefore.saleId);
    }
    return actionSuccess();
  });
}

export async function adminApproveWithdrawalRequestResultAction(
  lotId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminApproveWithdrawalRequestResultAction", async () => {
    const id = lotId.trim();
    if (!id) return actionFailure("Missing lot ID");
    const res = await authedServerFetch(
      `/admin/lots/${encodeURIComponent(id)}/approve-withdrawal-request`,
      {
        method: "POST",
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      return actionFailure((body as { error?: string }).error ?? "Failed to approve withdrawal");
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminBulkLotsResultAction(
  body: z.infer<typeof bulkLotsBodySchema>,
): Promise<ActionResult<BulkLotsActionResult>> {
  return instrumentServerAction("adminBulkLotsResultAction", async () => {
    const parsed = bulkLotsBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const access =
      parsed.data.op === "soft_delete"
        ? AUCTION_MANAGE_ACCESS
        : parsed.data.op === "cancel"
          ? SALES_ACCESS
          : LOTS_ACCESS;
    const denied = await denyUnlessAdminCapability(access);
    if (denied) return denied;
    const { adminLots } = getWriteContainer();
    const r = await adminLots.bulk(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status, r.code);
    }
    const bulk = parseBulkLotsApiResponse(r.data);
    if (!bulk) {
      return actionFailure("Unexpected bulk response from server");
    }
    revalidatePath("/admin/lots");
    revalidatePath("/admin/sales");
    for (const lotId of parsed.data.ids) {
      revalidateAdminLotDetail(lotId);
    }
    if (bulk.failed >= bulk.attempted) {
      return actionFailure(bulkLotsFailureMessage(bulk), undefined, undefined, undefined, { bulk });
    }
    return actionSuccess(bulk);
  });
}

export async function adminBulkUsersResultAction(
  body: z.infer<typeof adminBulkUsersBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkUsersResultAction", async () => {
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

export async function adminBulkInvitationsResultAction(
  body: z.infer<typeof adminBulkInvitationsBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkInvitationsResultAction", async () => {
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

export async function adminBulkSubmissionsResultAction(
  body: z.infer<typeof adminBulkSubmissionsBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminBulkSubmissionsResultAction", async () => {
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

export async function adminCapturePaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCapturePaymentResultAction", async () => {
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.capture(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminRefundPaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRefundPaymentResultAction", async () => {
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.refund(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminPaymentXeroSyncResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminPaymentXeroSyncResultAction", async () => {
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.xeroSync(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    if (!r.data.ok) {
      return actionFailure(r.data.error ?? "Xero sync failed");
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminSetUserStaffRoleResultAction(
  userId: string,
  body: z.infer<typeof adminPatchStaffRoleBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSetUserStaffRoleResultAction", async () => {
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

export async function adminXeroOAuthStartAction(): Promise<void> {
  return instrumentServerAction("adminXeroOAuthStartAction", async () => {
    const res = await authedServerFetch("/admin/integrations/xero/oauth/consent-url");
    if (!res.ok) {
      redirect(
        `/admin/integrations/xero?error=${encodeURIComponent("Could not start Xero OAuth")}`,
      );
    }
    const body = (await res.json()) as { data: { url: string } };
    redirect(body.data.url);
  });
}

export async function adminXeroDisconnectAction(): Promise<void> {
  return instrumentServerAction("adminXeroDisconnectAction", async () => {
    const res = await authedServerFetch("/admin/integrations/xero/disconnect", { method: "POST" });
    if (!res.ok) {
      redirect(`/admin/integrations/xero?error=${encodeURIComponent("Disconnect failed")}`);
    }
    revalidatePath("/admin/integrations/xero");
    redirect("/admin/integrations/xero");
  });
}

export async function adminCreateInvitationResultAction(
  values: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCreateInvitationResultAction", async () => {
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

const saleRegistrationActionParams = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export async function adminApproveSaleRegistrationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminApproveSaleRegistrationAction",
    async () => {
      const parsed = saleRegistrationActionParams.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        registrationId: String(formData.get("registrationId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/sales?error=${encodeURIComponent("Invalid registration")}`);
      }
      const { saleId, registrationId } = parsed.data;
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/sales/${encodeURIComponent(saleId)}/registrations?error=${encodeURIComponent(payload.error ?? "Approve failed")}`,
        );
      }
      revalidatePath(`/admin/sales/${saleId}/registrations`);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/registrations`);
    },
    { formData },
  );
}

export async function adminRejectSaleRegistrationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRejectSaleRegistrationAction",
    async () => {
      const parsed = saleRegistrationActionParams.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        registrationId: String(formData.get("registrationId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/sales?error=${encodeURIComponent("Invalid registration")}`);
      }
      const { saleId, registrationId } = parsed.data;
      const reasonRaw = String(formData.get("reason") ?? "").trim();
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reasonRaw ? { reason: reasonRaw } : {}),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/sales/${encodeURIComponent(saleId)}/registrations?error=${encodeURIComponent(payload.error ?? "Reject failed")}`,
        );
      }
      revalidatePath(`/admin/sales/${saleId}/registrations`);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/registrations`);
    },
    { formData },
  );
}

const conditionReportRequestIdActionSchema = z.object({
  requestId: z.string().uuid(),
});

export async function adminMarkConditionReportInProgressAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminMarkConditionReportInProgressAction",
    async () => {
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/mark-in-progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Could not mark in progress")}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports?success=Condition%20report%20marked%20in%20progress");
    },
    { formData },
  );
}

export async function adminFulfillConditionReportAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminFulfillConditionReportAction",
    async () => {
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const summary = String(formData.get("summary") ?? "").trim();
      const details = String(formData.get("details") ?? "").trim();
      const downloadUrl = String(formData.get("downloadUrl") ?? "").trim();
      const responseNote = String(formData.get("responseNote") ?? "").trim();
      if (!summary && !details && !downloadUrl) {
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent("Add summary, details, or PDF URL")}`,
        );
      }
      const conditionReport: {
        summary?: string;
        details?: string;
        downloadUrl?: string;
      } = {};
      if (summary) conditionReport.summary = summary;
      if (details) conditionReport.details = details;
      if (downloadUrl) conditionReport.downloadUrl = downloadUrl;

      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditionReport,
            ...(responseNote ? { responseNote } : {}),
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Fulfil failed")}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports");
    },
    { formData },
  );
}

export async function adminDeclineConditionReportAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminDeclineConditionReportAction",
    async () => {
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const responseNote = String(formData.get("responseNote") ?? "").trim();
      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(responseNote ? { responseNote } : {}),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Decline failed")}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports");
    },
    { formData },
  );
}

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

export async function adminLotFulfilmentReleaseAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminLotFulfilmentReleaseAction",
    async () => {
      const returnStatus = readLotFulfilmentReturnStatus(formData);
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

const saleroomSaleIdForm = z.object({
  saleId: z.string().uuid(),
});

const saleroomAdvanceForm = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
});

function redirectSaleroomError(saleId: string, message: string): never {
  redirect(`/admin/saleroom/${encodeURIComponent(saleId)}?error=${encodeURIComponent(message)}`);
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/go-live`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Go live failed");
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/resume`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Resume failed");
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/hammer`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "Hammer failed");
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      const res = await authedServerFetch(
        `/admin/sales/${encodeURIComponent(saleId)}/saleroom/no-sale`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirectSaleroomError(saleId, payload.error ?? "No sale failed");
      }
      revalidatePath(`/admin/saleroom/${saleId}`);
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
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
      redirect(`/admin/saleroom/${encodeURIComponent(saleId)}`);
    },
    { formData },
  );
}
