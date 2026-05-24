"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  adminUpdateArtistResultAction,
  adminUpdateCategoryResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import {
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  updateLotSchema,
  updateProfileNameFormSchema,
  updateSaleSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function adminUpdateCategoryNameFieldAction(
  categoryId: string,
  name: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateCategoryNameFieldAction", async () => {
    const parsed = adminUpdateCategoryBodySchema.safeParse({ name });
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    return adminUpdateCategoryResultAction(categoryId, parsed.data);
  });
}

export async function adminUpdateArtistNameFieldAction(
  artistId: string,
  displayName: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateArtistNameFieldAction", async () => {
    const parsed = adminUpdateArtistBodySchema.safeParse({ displayName });
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const result = await adminUpdateArtistResultAction(artistId, parsed.data);
    if (result.ok) {
      revalidatePath(`/admin/artists/${artistId}`);
    }
    return result;
  });
}

export async function adminUpdateSaleTitleFieldAction(
  saleId: string,
  title: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateSaleTitleFieldAction", async () => {
    const parsed = updateSaleSchema.safeParse({ title });
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    return adminUpdateSaleResultAction(saleId, parsed.data);
  });
}

export async function adminUpdateLotTitleFieldAction(
  lotId: string,
  title: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateLotTitleFieldAction", async () => {
    const parsed = updateLotSchema.safeParse({ title });
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    return adminUpdateLotResultAction(lotId, parsed.data);
  });
}

export async function adminUpdateClientDisplayNameFieldAction(
  userId: string,
  name: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateClientDisplayNameFieldAction", async () => {
    const id = userId.trim();
    if (!id) return actionFailure("Missing user");
    const parsed = updateProfileNameFormSchema.safeParse({ name });
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: parsed.data.name }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      return actionFailure(
        payload.error ?? payload.message ?? "Could not update display name",
        undefined,
        res.status,
      );
    }
    revalidateAdminUserDetailPaths(id);
    return actionSuccess();
  });
}

function revalidateAdminUserDetailPaths(userId: string): void {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/staff");
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath(`/admin/staff/${userId}`);
}
