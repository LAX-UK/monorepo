"use server";

import { isUuid } from "@/lib/editorial-entity-forms";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid Help centre request.",
} as const satisfies AdminMutationResult<never>;

const articlePath = (id?: string | null): string | null => {
  if (id === undefined || id === null) return "help/articles";
  return isUuid(id) ? `help/articles/${id}` : null;
};

const categoryPath = (id?: string | null): string | null => {
  if (id === undefined || id === null) return "help/categories";
  return isUuid(id) ? `help/categories/${id}` : null;
};

const allUuids = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string" && isUuid(id));

/** The id, and the row's new version when an existing row was updated. */
export type HelpSaveResult = { id: string; version: string | null };

async function saveRow(
  path: string | null,
  input: {
    id: string | null;
    payload: unknown;
    expectedVersion: string | null;
    idempotencyKey: string;
  },
): Promise<AdminMutationResult<HelpSaveResult>> {
  if (!path) return invalidInput;
  if (input.id) {
    if (!input.expectedVersion) return invalidInput;
    const result = await forwardAdminJsonMutation<{ version: string }>({
      bffPath: path,
      method: "PUT",
      jsonBody: { ...(input.payload as object), expectedVersion: input.expectedVersion },
      idempotencyKey: input.idempotencyKey,
    });
    return result.ok ? { ok: true, data: { id: input.id, version: result.data.version } } : result;
  }
  const created = await forwardAdminJsonMutation<{ id: string }>({
    bffPath: path,
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
  return created.ok ? { ok: true, data: { id: created.data.id, version: null } } : created;
}

export async function getHelpArticleDetail(id: string): Promise<AdminMutationResult<unknown>> {
  const path = articlePath(id);
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
      return { ok: false, kind: "failed", message: "This question no longer exists." };
    default:
      return { ok: false, kind: "failed", message: "Could not load this question." };
  }
}

export async function saveHelpArticle(input: {
  id: string | null;
  payload: unknown;
  expectedVersion: string | null;
  idempotencyKey: string;
}): Promise<AdminMutationResult<HelpSaveResult>> {
  return saveRow(articlePath(input.id), input);
}

/** Publishing changes the row's version, so the editor is handed the new one to save against. */
export async function setHelpArticlePublication(input: {
  id: string;
  published: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = articlePath(input.id);
  if (!path) return invalidInput;
  const changed = await forwardAdminJsonMutation({
    bffPath: `${path}/${input.published ? "publish" : "unpublish"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
  if (!changed.ok) return changed;
  const detail = await fetchAdminJson<{ updatedAt: string }>(path);
  return detail.status === "ok"
    ? { ok: true, data: { version: detail.data.updatedAt } }
    : { ok: false, kind: "failed", message: "Could not reload this question." };
}

export async function issueHelpPreviewToken(input: {
  id: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ token: string; expiresAt: string }>> {
  if (!articlePath(input.id)) return invalidInput;
  return forwardAdminJsonMutation<{ token: string; expiresAt: string }>({
    bffPath: "editorial/preview-token",
    method: "POST",
    jsonBody: { entity: "help_article", id: input.id },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function deleteHelpArticle(input: {
  id: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = articlePath(input.id);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "DELETE",
    idempotencyKey: input.idempotencyKey,
  });
}

/** The complete order of the category's questions, first to last. */
export async function reorderHelpArticles(input: {
  categoryId: string;
  ids: string[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = categoryPath(input.categoryId);
  if (!path || !allUuids(input.ids)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/articles/order`,
    method: "PUT",
    jsonBody: { ids: input.ids },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveHelpCategory(input: {
  id: string | null;
  payload: unknown;
  expectedVersion: string | null;
  idempotencyKey: string;
}): Promise<AdminMutationResult<HelpSaveResult>> {
  return saveRow(categoryPath(input.id), input);
}

export async function setHelpCategoryPublication(input: {
  id: string;
  published: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = categoryPath(input.id);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/${input.published ? "publish" : "unpublish"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function deleteHelpCategory(input: {
  id: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = categoryPath(input.id);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "DELETE",
    idempotencyKey: input.idempotencyKey,
  });
}

/** The complete order of every category, first to last. */
export async function reorderHelpCategories(input: {
  ids: string[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  if (!allUuids(input.ids)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: "help/categories/order",
    method: "PUT",
    jsonBody: { ids: input.ids },
    idempotencyKey: input.idempotencyKey,
  });
}
