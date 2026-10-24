"use server";

import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { ServiceResult } from "@/lib/services/http/service-result";
import {
  type AdminSavedViewDto,
  adminSavedViewCreateBodySchema,
  adminSavedViewIdParamSchema,
  adminSavedViewListQuerySchema,
  adminSavedViewRenameBodySchema,
  adminSavedViewReorderBodySchema,
} from "@auction/validators";

/** What the browser needs of a view; the owner and list are implied by who asks. */
export type SavedViewRow = Pick<AdminSavedViewDto, "id" | "label" | "query">;

const toRow = ({ id, label, query }: AdminSavedViewDto): SavedViewRow => ({ id, label, query });

async function denyUnlessSignedIn(): Promise<ActionResult<never> | null> {
  return (await getServerSessionUser()) ? null : actionFailure("Sign in required", undefined, 401);
}

function failed(result: Extract<ServiceResult<unknown>, { ok: false }>): ActionResult<never> {
  return actionFailure(result.message, undefined, result.status, result.code);
}

/**
 * Saved views belong to the person asking: the Bid API reads who that is from the session, and
 * decides per list whether they may keep views for it. These actions only validate the input.
 */
export async function adminListSavedViewsAction(
  input: unknown,
): Promise<ActionResult<SavedViewRow[]>> {
  return instrumentServerAction("adminListSavedViewsAction", async () => {
    const denied = await denyUnlessSignedIn();
    if (denied) return denied;
    const parsed = adminSavedViewListQuerySchema.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const result = await getWriteContainer().adminSavedViews.list(parsed.data.listKey);
    return result.ok ? actionSuccess(result.data.map(toRow)) : failed(result);
  });
}

export async function adminCreateSavedViewAction(
  input: unknown,
): Promise<ActionResult<SavedViewRow>> {
  return instrumentServerAction("adminCreateSavedViewAction", async () => {
    const denied = await denyUnlessSignedIn();
    if (denied) return denied;
    const parsed = adminSavedViewCreateBodySchema.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const result = await getWriteContainer().adminSavedViews.create(parsed.data);
    return result.ok ? actionSuccess(toRow(result.data)) : failed(result);
  });
}

export async function adminRenameSavedViewAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<SavedViewRow>> {
  return instrumentServerAction("adminRenameSavedViewAction", async () => {
    const denied = await denyUnlessSignedIn();
    if (denied) return denied;
    const params = adminSavedViewIdParamSchema.safeParse({ id });
    const body = adminSavedViewRenameBodySchema.safeParse(input);
    if (!params.success) return actionFailure(firstZodErrorMessage(params.error));
    if (!body.success) return actionFailure(firstZodErrorMessage(body.error));
    const result = await getWriteContainer().adminSavedViews.rename(
      params.data.id,
      body.data.label,
    );
    return result.ok ? actionSuccess(toRow(result.data)) : failed(result);
  });
}

export async function adminReorderSavedViewsAction(input: unknown): Promise<ActionResult> {
  return instrumentServerAction("adminReorderSavedViewsAction", async () => {
    const denied = await denyUnlessSignedIn();
    if (denied) return denied;
    const parsed = adminSavedViewReorderBodySchema.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const result = await getWriteContainer().adminSavedViews.reorder(
      parsed.data.listKey,
      parsed.data.ids,
    );
    return result.ok ? actionSuccess() : failed(result);
  });
}

export async function adminDeleteSavedViewAction(id: unknown): Promise<ActionResult> {
  return instrumentServerAction("adminDeleteSavedViewAction", async () => {
    const denied = await denyUnlessSignedIn();
    if (denied) return denied;
    const params = adminSavedViewIdParamSchema.safeParse({ id });
    if (!params.success) return actionFailure(firstZodErrorMessage(params.error));
    const result = await getWriteContainer().adminSavedViews.remove(params.data.id);
    return result.ok ? actionSuccess() : failed(result);
  });
}
