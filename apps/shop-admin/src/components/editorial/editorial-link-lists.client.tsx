"use client";

import { RelationListEditor } from "@/components/editorial/relation-list-editor.client";
import type { LinksController } from "@/components/editorial/use-editorial-links.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { searchEditorialLinkCandidates } from "@/server/application/admin-editorial-links-actions.server";
import {
  type LinkRow,
  type LinkSectionSpec,
  publicRailNote,
  toLinkRow,
} from "@/server/domain/editorial-links.vm";
import { ConfirmActionDialog, Notice, Section, StaffButton, toast } from "@auction/staff-ui";
import { useCallback, useState } from "react";

function useLinkSearch(spec: LinkSectionSpec) {
  return useCallback(
    async (query: string): Promise<LinkRow[]> => {
      const result = await searchEditorialLinkCandidates({
        kind: spec.candidateKind,
        query,
        cursor: null,
      });
      if (!result.ok) throw new Error(adminMutationErrorMessage(result));
      return result.data.items.map(toLinkRow);
    },
    [spec.candidateKind],
  );
}

function LinkListSection({
  controller,
  spec,
}: {
  controller: LinksController;
  spec: LinkSectionSpec;
}) {
  const items = controller.state.current[spec.list] ?? [];
  const note = publicRailNote(spec, items.length);
  const search = useLinkSearch(spec);
  return (
    <Section id={`links-${spec.list}`} title={spec.heading} description={spec.description}>
      <div className="flex flex-col gap-3">
        <RelationListEditor
          label={spec.heading}
          plural={spec.noun}
          items={items}
          onChange={(next) => controller.edit(spec.list, next)}
          search={search}
          ordered={spec.ordered}
          disabled={controller.busy !== null}
          emptyText={`No ${spec.noun} linked yet.`}
          addLabel={`Add ${spec.singular}`}
        />
        {note ? <p className="text-staff-sm text-staff-muted">{note}</p> : null}
      </div>
    </Section>
  );
}

/**
 * The linked artworks, artists and stories (or exhibitions) of a saved exhibition or story. The
 * lists have no buttons of their own: the editor's one Save stores them with the rest of the
 * item. When someone else changed them first, the editor says so and offers to reload theirs or
 * keep yours.
 */
export function EditorialLinkLists({
  controller,
  onFailure,
}: {
  controller: LinksController;
  /** Where a failed save over a conflict is reported: the editor's own alert, never a toast. */
  onFailure: (failure: { text: string; stepUp: boolean }) => void;
}) {
  const [dialog, setDialog] = useState<"reload" | "overwrite" | null>(null);
  const busy = controller.busy !== null;
  const noun = controller.parent === "exhibitions" ? "exhibition" : "story";
  const conflict = controller.conflictVersion;

  return (
    <div className="flex flex-col gap-6">
      {conflict ? (
        <Notice
          tone="warning"
          alert
          title={`Someone else changed the linked records of this ${noun}`}
          actions={
            <>
              <StaffButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setDialog("reload")}
              >
                Reload
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setDialog("overwrite")}
              >
                Keep my changes
              </StaffButton>
            </>
          }
        >
          Your changes to them were not saved. Reload to see their version, which discards your
          changes, or keep your changes and save over theirs.
        </Notice>
      ) : null}
      {controller.specs.map((spec) => (
        <LinkListSection key={spec.list} controller={controller} spec={spec} />
      ))}
      <ConfirmActionDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to the linked records of this ${noun}?`}
        description="Reloading shows the lists as they are saved now. Your unsaved changes to them are lost and cannot be recovered."
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        tone="danger"
        loading={controller.busy === "reload"}
        onConfirm={async () => {
          const ok = await controller.reload();
          setDialog(null);
          if (!ok) toast.error("Could not reload the linked records. Try again.");
        }}
      />
      <ConfirmActionDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Save over the other changes?"
        description="Saving now replaces the lists someone else saved with your version. Their changes cannot be recovered afterwards."
        confirmLabel="Save my version"
        cancelLabel="Go back"
        tone="danger"
        loading={controller.busy === "save"}
        onConfirm={async () => {
          if (!conflict) return;
          const result = await controller.save({ overwriteVersion: conflict });
          setDialog(null);
          if (result.ok) toast.success("Linked records saved.");
          else if (result.kind === "failed") onFailure(result);
        }}
      />
    </div>
  );
}

/** What a new, unsaved item shows in place of the lists: they need a saved item to attach to. */
export function EditorialLinksAfterFirstSave({ what }: { what: string }) {
  return (
    <Section title="Linked records">
      <p className="text-staff-sm text-staff-muted">
        {what} can be linked once the draft has been created. Create the draft first, then come back
        to this section.
      </p>
    </Section>
  );
}
