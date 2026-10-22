"use client";

import { EditorialConflictBanner } from "@/components/editorial/editorial-conflict-banner.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getEditorialLinks,
  replaceEditorialLinkList,
  searchEditorialLinkCandidates,
} from "@/server/application/admin-editorial-links-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import {
  type EditorialLinkParent,
  type LinkRow,
  type LinkSectionSpec,
  type LinksPayload,
  type LinksState,
  adoptStoredLinks,
  anyLinkListDirty,
  editLinkList,
  initialLinksState,
  isLinkListDirty,
  linkListIds,
  linkSectionsFor,
  markLinkListSaved,
  publicRailNote,
  toLinkRow,
  unknownRecordsMessage,
} from "@/server/domain/editorial-links.vm";
import {
  Alert,
  AlertDescription,
  ConfirmDialog,
  LoadingButton,
  RelationPicker,
  type RelationSearchPage,
  toast,
} from "@auction/ui";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";

type Failure = { text: string; stepUp: boolean };
type Dialog = "reload" | "overwrite";

const newKey = () => crypto.randomUUID();

/** Enter in a search box must not submit the entity form that these sections sit inside. */
function keepEnterFromSubmitting(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
}

function LinkListSection({
  parent,
  id,
  spec,
  state,
  onEdit,
  onSaved,
  onReloaded,
}: {
  parent: EditorialLinkParent;
  id: string;
  spec: LinkSectionSpec;
  state: LinksState;
  onEdit: (items: LinkRow[]) => void;
  onSaved: (version: string) => void;
  onReloaded: (payload: LinksPayload) => void;
}) {
  const headingId = useId();
  const pathname = usePathname();
  const items = state.current[spec.list] ?? [];
  const dirty = isLinkListDirty(state, spec);
  const note = publicRailNote(spec, items.length);
  const [busy, setBusy] = useState<"save" | "reload" | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const search = useCallback(
    async (
      query: string,
      cursor: string | null,
      signal: AbortSignal,
    ): Promise<RelationSearchPage<LinkRow>> => {
      const result = await searchEditorialLinkCandidates({
        kind: spec.candidateKind,
        query,
        cursor,
      });
      if (signal.aborted) return { items: [], nextCursor: null };
      if (!result.ok) throw new Error(adminMutationErrorMessage(result));
      return { items: result.data.items.map(toLinkRow), nextCursor: result.data.nextCursor };
    },
    [spec.candidateKind],
  );

  /** A repeat of the same request reuses its key; a changed request gets a new one. */
  function keyFor(signature: string): string {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newKey() };
    return attempt.current.key;
  }

  async function attempted<T>(work: () => Promise<AdminMutationResult<T>>) {
    try {
      return await work();
    } catch {
      return { ok: false, kind: "failed", message: "" } as const;
    }
  }

  async function save(expectedVersion: string = state.version) {
    setBusy("save");
    setFailure(null);
    const ids = linkListIds(state, spec.list);
    const result = await attempted(() =>
      replaceEditorialLinkList({
        parent,
        id,
        list: spec.list,
        ids,
        expectedVersion,
        idempotencyKey: keyFor(JSON.stringify([id, spec.list, expectedVersion, ids])),
      }),
    );
    setBusy(null);
    if (result.ok) {
      attempt.current = null;
      setConflictVersion(null);
      onSaved(result.data.version);
      toast.success(`${spec.heading} saved.`);
      return;
    }
    if (result.kind === "conflict" && result.currentVersion) {
      setConflictVersion(result.currentVersion);
    } else if (result.kind === "unknown_ids") {
      setFailure({
        text: unknownRecordsMessage(spec, result.missingIds, items),
        stepUp: false,
      });
    } else {
      setFailure({
        text:
          result.kind === "failed"
            ? `Could not save ${spec.noun}. The service is unavailable. Try again.`
            : adminMutationErrorMessage(result),
        stepUp: result.kind === "step_up_required",
      });
    }
  }

  async function reload() {
    setBusy("reload");
    const result = await attempted(() => getEditorialLinks(parent, id));
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure({ text: `Could not reload ${spec.noun}. Try again.`, stepUp: false });
      return;
    }
    attempt.current = null;
    setConflictVersion(null);
    setFailure(null);
    onReloaded(result.data);
  }

  const disabled = busy !== null;
  return (
    <section aria-labelledby={headingId} className="space-y-3" onKeyDown={keepEnterFromSubmitting}>
      <div>
        <h2 id={headingId} className="text-lg font-medium">
          {spec.heading}
        </h2>
        <p className="text-sm text-on-surface-variant">{spec.description}</p>
      </div>

      {conflictVersion ? (
        <EditorialConflictBanner
          singular={`list of ${spec.noun}`}
          busy={disabled}
          onReload={() => setDialog("reload")}
          onKeepMine={() => setDialog("overwrite")}
        />
      ) : null}
      {failure ? (
        <Alert variant="destructive">
          <AlertDescription>
            {failure.text}
            {failure.stepUp ? (
              <>
                {" "}
                <a
                  href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}
                  className="underline"
                >
                  Sign in again
                </a>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <RelationPicker
        label={spec.heading}
        items={items}
        onChange={onEdit}
        search={search}
        ordered={spec.ordered}
        disabled={disabled}
        emptyText={`No ${spec.noun} linked yet.`}
      />
      {note ? <p className="text-sm text-on-surface-variant">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton
          type="button"
          variant="outline"
          loading={busy === "save"}
          loadingLabel="Saving…"
          disabled={disabled || !dirty}
          onClick={() => void save()}
        >
          {spec.saveLabel}
        </LoadingButton>
        <output aria-live="polite" className="text-sm text-on-surface-variant">
          {dirty ? "Unsaved changes" : ""}
        </output>
      </div>

      <ConfirmDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to the ${spec.noun}?`}
        body={`Reloading shows the list as it is saved now. Your unsaved changes to the ${spec.noun} are lost and cannot be recovered.`}
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        loading={busy === "reload"}
        onConfirm={reload}
      />
      <ConfirmDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Save over the other changes to the ${spec.noun}?`}
        body="Saving now replaces the list someone else saved with your version. Their changes cannot be recovered afterwards."
        confirmLabel="Save my version"
        cancelLabel="Go back"
        loading={busy === "save"}
        onConfirm={async () => {
          const current = conflictVersion;
          setDialog(null);
          if (current) await save(current);
        }}
      />
    </section>
  );
}

/**
 * The linked artworks, artists and stories (or exhibitions) of a saved exhibition or story. Each
 * list is saved on its own, apart from the entity's own Save, but they share one version token,
 * which this component keeps current as lists are saved.
 */
export function EditorialLinksSections({
  parent,
  id,
  links,
  onDirtyChange,
}: {
  parent: EditorialLinkParent;
  id: string;
  links: LinksPayload;
  /** True while any list has edits that are not saved. */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const specs = linkSectionsFor(parent);
  const [state, setState] = useState(() => initialLinksState(links, specs));
  const dirty = anyLinkListDirty(state, specs);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  return (
    <div className="space-y-8">
      {specs.map((spec) => (
        <LinkListSection
          key={spec.list}
          parent={parent}
          id={id}
          spec={spec}
          state={state}
          onEdit={(items) => setState((previous) => editLinkList(previous, spec.list, items))}
          onSaved={(version) =>
            setState((previous) => markLinkListSaved(previous, spec.list, version))
          }
          onReloaded={(payload) =>
            setState((previous) => adoptStoredLinks(previous, payload, specs, spec.list))
          }
        />
      ))}
    </div>
  );
}

/** What a new, unsaved item shows in place of the lists: they need a saved item to attach to. */
export function EditorialLinksAfterFirstSave({ what }: { what: string }) {
  return (
    <section aria-label="Linked content" className="space-y-1">
      <h2 className="text-lg font-medium">Linked content</h2>
      <p className="text-sm text-on-surface-variant">
        {what} can be linked once the draft has been created. Create the draft first, then come back
        to this section.
      </p>
    </section>
  );
}
