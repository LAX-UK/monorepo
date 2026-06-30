"use server";

import { revalidateAdminCategoryDetail } from "@/lib/actions/admin/_shared/revalidate-paths";
import {
  getIdempotentCategoryCreate,
  setIdempotentCategoryCreate,
} from "@/lib/actions/idempotency-cache";
import { revalidateCatalogueCache } from "@/lib/actions/revalidate-catalogue";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import {
  ARTIST_DELETE_ACCESS,
  ARTIST_MERGE_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
  CATEGORIES_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  artistDeleteBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    revalidateCatalogueCache();
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
    revalidateCatalogueCache();
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
