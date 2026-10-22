import type { EditorialEntityKind } from "@/lib/editorial-entity-forms";
import {
  type EditorialSaveResult,
  getEditorialEntityDetail,
  issueEditorialPreviewToken,
  saveEditorialEntity,
  setEditorialPublication,
} from "@/server/application/admin-editorial-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";

/**
 * What the shared editor needs from an entity's backend, so editorial items and Help centre
 * questions use one editor while each keeps its own routes and server actions.
 */
export type EditorialEditorApi = {
  save(input: {
    id: string | null;
    payload: unknown;
    /** Required to update: the version the editor opened, or the one it chose to overwrite. */
    expectedVersion: string | null;
    idempotencyKey: string;
  }): Promise<AdminMutationResult<EditorialSaveResult>>;
  /** Resolves to the row's new version, which the next save is checked against. */
  setPublication(input: {
    id: string;
    published: boolean;
    idempotencyKey: string;
  }): Promise<AdminMutationResult<{ version: string }>>;
  createPreview(input: {
    id: string;
    idempotencyKey: string;
  }): Promise<AdminMutationResult<{ token: string; expiresAt: string }>>;
  /** The stored item, for reloading after someone else saved first. */
  reload(id: string): Promise<AdminMutationResult<unknown>>;
  /** Where the editor goes once a new draft has been created. */
  detailHref(id: string): string;
};

export function editorialEntityApi(kind: EditorialEntityKind): EditorialEditorApi {
  return {
    save: (input) => saveEditorialEntity({ kind, ...input }),
    setPublication: (input) => setEditorialPublication({ kind, ...input }),
    createPreview: (input) => issueEditorialPreviewToken({ kind, ...input }),
    reload: (id) => getEditorialEntityDetail(kind, id),
    detailHref: (id) => `/editorial/${kind}/${id}`,
  };
}
