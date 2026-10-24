"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getEditorialLinks,
  replaceEditorialLinkList,
} from "@/server/application/admin-editorial-links-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import {
  type EditorialLinkList,
  type EditorialLinkParent,
  type LinkRow,
  type LinkSectionSpec,
  type LinksPayload,
  type LinksState,
  anyLinkListDirty,
  editLinkList,
  initialLinksState,
  isLinkListDirty,
  linkListIds,
  linkSectionsFor,
  markLinkListSaved,
  unknownRecordsMessage,
} from "@/server/domain/editorial-links.vm";
import { useCallback, useRef, useState } from "react";

export type LinksSaveResult =
  | { ok: true }
  /** Someone else changed the links first; nothing newer was overwritten. */
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "failed"; text: string; stepUp: boolean };

/**
 * The related records of a saved exhibition or story, held for the editor's one Save. Each list is
 * still stored by its own endpoint, so saving sends the lists that changed one after another, each
 * against the version the previous one returned; the editor decides when that happens.
 */
export type LinksController = {
  parent: EditorialLinkParent;
  specs: readonly LinkSectionSpec[];
  state: LinksState;
  dirty: boolean;
  /** "reload" while the stored lists are being fetched again. */
  busy: "save" | "reload" | null;
  /** The version someone else saved, once a save has found the links changed. */
  conflictVersion: string | null;
  edit(list: EditorialLinkList, rows: LinkRow[]): void;
  /** Saves every changed list; `overwriteVersion` saves over a conflicting newer version. */
  save(options?: { overwriteVersion?: string }): Promise<LinksSaveResult>;
  /** Replaces every list with what is stored now, discarding edits. */
  reload(): Promise<boolean>;
};

const newKey = () => crypto.randomUUID();

export function useEditorialLinks(
  parent: EditorialLinkParent,
  id: string | null,
  links: LinksPayload | null,
): LinksController | null {
  const specs = linkSectionsFor(parent);
  const [state, setState] = useState<LinksState | null>(() =>
    links ? initialLinksState(links, specs) : null,
  );
  const latest = useRef(state);
  latest.current = state;
  const [busy, setBusy] = useState<"save" | "reload" | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  /** A repeat of the same request reuses its key; a changed request gets a new one. */
  const keyFor = useCallback((signature: string) => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newKey() };
    return attempt.current.key;
  }, []);

  const edit = useCallback((list: EditorialLinkList, rows: LinkRow[]) => {
    setState((previous) => (previous ? editLinkList(previous, list, rows) : previous));
  }, []);

  const save = useCallback(
    async (options?: { overwriteVersion?: string }): Promise<LinksSaveResult> => {
      const snapshot = latest.current;
      if (!snapshot || !id) return { ok: true };
      setBusy("save");
      try {
        let version = options?.overwriteVersion ?? snapshot.version;
        for (const spec of specs) {
          if (!isLinkListDirty(snapshot, spec)) continue;
          const ids = linkListIds(snapshot, spec.list);
          let result: AdminMutationResult<{ version: string }>;
          try {
            result = await replaceEditorialLinkList({
              parent,
              id,
              list: spec.list,
              ids,
              expectedVersion: version,
              idempotencyKey: keyFor(JSON.stringify([id, spec.list, version, ids])),
            });
          } catch {
            result = { ok: false, kind: "failed", message: "" };
          }
          if (result.ok) {
            version = result.data.version;
            const saved = version;
            setState((previous) =>
              previous ? markLinkListSaved(previous, spec.list, saved) : previous,
            );
            continue;
          }
          if (result.kind === "conflict" && result.currentVersion) {
            setConflictVersion(result.currentVersion);
            return { ok: false, kind: "conflict" };
          }
          if (result.kind === "unknown_ids") {
            return {
              ok: false,
              kind: "failed",
              text: unknownRecordsMessage(
                spec,
                result.missingIds,
                snapshot.current[spec.list] ?? [],
              ),
              stepUp: false,
            };
          }
          return {
            ok: false,
            kind: "failed",
            text:
              result.kind === "failed"
                ? `Could not save the ${spec.noun}. The service is unavailable. Try again.`
                : adminMutationErrorMessage(result),
            stepUp: result.kind === "step_up_required",
          };
        }
        attempt.current = null;
        setConflictVersion(null);
        return { ok: true };
      } finally {
        setBusy(null);
      }
    },
    [id, parent, specs, keyFor],
  );

  const reload = useCallback(async () => {
    if (!id) return false;
    setBusy("reload");
    try {
      const result = await getEditorialLinks(parent, id);
      if (!result.ok) return false;
      attempt.current = null;
      setConflictVersion(null);
      setState(initialLinksState(result.data, specs));
      return true;
    } catch {
      return false;
    } finally {
      setBusy(null);
    }
  }, [id, parent, specs]);

  if (!state) return null;
  return {
    parent,
    specs,
    state,
    dirty: anyLinkListDirty(state, specs),
    busy,
    conflictVersion,
    edit,
    save,
    reload,
  };
}
