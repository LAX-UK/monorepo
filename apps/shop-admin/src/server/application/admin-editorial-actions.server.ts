"use server";

import {
  EDITORIAL_PREVIEW_ENTITY,
  type EditorialEntityKind,
  isUuid,
} from "@/lib/editorial-entity-forms";
import { EDITORIAL_PLACEMENT_SLOTS, type EditorialPlacementSlot } from "@/lib/editorial-placements";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const ENTITY_KINDS = Object.keys(EDITORIAL_PREVIEW_ENTITY) as EditorialEntityKind[];

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid editorial request.",
} as const satisfies AdminMutationResult<never>;

function entityPath(kind: EditorialEntityKind, id?: string | null): string | null {
  if (!ENTITY_KINDS.includes(kind)) return null;
  if (id === undefined || id === null) return `editorial/${kind}`;
  return isUuid(id) ? `editorial/${kind}/${id}` : null;
}

export async function getEditorialEntityDetail(
  kind: EditorialEntityKind,
  id: string,
): Promise<AdminMutationResult<unknown>> {
  const path = entityPath(kind, id);
  if (!path) return invalidInput;
  const result = await fetchAdminJson<unknown>(path);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    case "not_found":
      return { ok: false, kind: "failed", message: "This item no longer exists." };
    default:
      return { ok: false, kind: "failed", message: "Could not load this item." };
  }
}

export async function saveEditorialEntity(input: {
  kind: EditorialEntityKind;
  id: string | null;
  payload: unknown;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ id: string }>> {
  const path = entityPath(input.kind, input.id);
  if (!path) return invalidInput;
  if (input.id) {
    const result = await forwardAdminJsonMutation({
      bffPath: path,
      method: "PUT",
      jsonBody: input.payload,
      idempotencyKey: input.idempotencyKey,
    });
    return result.ok ? { ok: true, data: { id: input.id } } : result;
  }
  return forwardAdminJsonMutation<{ id: string }>({
    bffPath: path,
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setEditorialPublication(input: {
  kind: EditorialEntityKind;
  id: string;
  published: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = entityPath(input.kind, input.id);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/${input.published ? "publish" : "unpublish"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function issueEditorialPreviewToken(input: {
  kind: EditorialEntityKind;
  id: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ token: string; expiresAt: string }>> {
  if (!entityPath(input.kind, input.id)) return invalidInput;
  return forwardAdminJsonMutation<{ token: string; expiresAt: string }>({
    bffPath: "editorial/preview-token",
    method: "POST",
    jsonBody: { entity: EDITORIAL_PREVIEW_ENTITY[input.kind], id: input.id },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function replaceEditorialPlacementSlot(input: {
  slot: EditorialPlacementSlot;
  items: unknown[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  if (!EDITORIAL_PLACEMENT_SLOTS.includes(input.slot) || !Array.isArray(input.items)) {
    return invalidInput;
  }
  return forwardAdminJsonMutation({
    bffPath: `editorial/placements/${input.slot}`,
    method: "PUT",
    jsonBody: { items: input.items },
    idempotencyKey: input.idempotencyKey,
  });
}
