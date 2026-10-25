"use client";

import { EditorialErrorList, EditorialStatusMessage } from "@/components/editorial-status-message";
import { SelectField, TextField } from "@/components/forms/fields";
import { MediaUploadField } from "@/components/media-upload-field";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
import type { EditorialAdminRow } from "@/lib/editorial-entity-forms";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import {
  type AdminPlacementRow,
  EDITORIAL_PLACEMENT_SLOTS,
  type EditorialPlacementSlot,
  PLACEMENT_MAX_ROWS,
  PLACEMENT_REF_KINDS,
  PLACEMENT_SLOT_LABELS,
  type PlacementDraft,
  type PlacementRefKind,
  buildPlacementSlotPayload,
  emptyPlacementDraft,
  placementDraftsBySlot,
} from "@/lib/editorial-placements";
import { replaceEditorialPlacementSlot } from "@/server/application/admin-editorial-actions.server";
import { EmptyState, useBeforeUnloadGuard } from "@auction/staff-ui";
import { Button } from "@auction/ui";
import { useState } from "react";

export type PlacementRefLists = Record<
  Exclude<PlacementRefKind, "external">,
  readonly EditorialAdminRow[]
>;

const newKey = () => crypto.randomUUID();

const REF_KIND_OPTIONS = PLACEMENT_REF_KINDS.map((kind) => ({
  value: kind,
  label: kind === "external" ? "External link" : kind,
}));

function PlacementRowFields({
  draft,
  index,
  count,
  refLists,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  draft: PlacementDraft;
  index: number;
  count: number;
  refLists: PlacementRefLists;
  disabled: boolean;
  onChange: (next: PlacementDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const label = `row ${index + 1}`;
  const refRows = draft.refKind === "external" ? [] : refLists[draft.refKind];
  const refOptions = [
    { value: "", label: `Choose a ${draft.refKind}…` },
    ...refRows.map((row) => ({
      value: row.id,
      label: `${row.label}${row.status === "draft" ? " (draft)" : ""}`,
    })),
  ];
  if (draft.refId && !refRows.some((row) => row.id === draft.refId)) {
    refOptions.push({ value: draft.refId, label: "Unknown item (removed?)" });
  }
  return (
    <li className="space-y-3 rounded border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Row {index + 1}</p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || index === 0}
            aria-label={`Move ${label} up`}
            onClick={() => onMove(-1)}
          >
            Up
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || index === count - 1}
            aria-label={`Move ${label} down`}
            onClick={() => onMove(1)}
          >
            Down
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`Remove ${label}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Links to"
          value={draft.refKind}
          options={REF_KIND_OPTIONS}
          disabled={disabled}
          onChange={(refKind) => onChange({ ...draft, refKind, refId: "" })}
        />
        {draft.refKind === "external" ? null : (
          <SelectField
            label={`Featured ${draft.refKind}`}
            value={draft.refId}
            options={refOptions}
            disabled={disabled}
            onChange={(refId) => onChange({ ...draft, refId })}
          />
        )}
        <TextField
          label="Headline (optional)"
          value={draft.headline}
          maxLength={300}
          disabled={disabled}
          onChange={(headline) => onChange({ ...draft, headline })}
        />
        <TextField
          label={draft.refKind === "external" ? "Link URL" : "Link URL (optional)"}
          hint="https://…, mailto:… or a site path such as /visit"
          value={draft.linkUrl}
          maxLength={2048}
          required={draft.refKind === "external"}
          disabled={disabled}
          onChange={(linkUrl) => onChange({ ...draft, linkUrl })}
        />
      </div>
      <MediaUploadField
        kind="editorial_cover"
        label="Placement image (optional)"
        value={draft.mediaKey}
        disabled={disabled}
        onChange={(mediaKey) => onChange({ ...draft, mediaKey })}
      />
    </li>
  );
}

function PlacementSlotEditor({
  slot,
  initialDrafts,
  refLists,
}: {
  slot: EditorialPlacementSlot;
  initialDrafts: PlacementDraft[];
  refLists: PlacementRefLists;
}) {
  const { status, setStatus, pending, run } = useEditorialMutation();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [dirty, setDirty] = useState(false);
  useBeforeUnloadGuard(dirty);
  const [errors, setErrors] = useState<string[]>([]);
  const headingId = `placement-${slot}-heading`;

  const update = (next: PlacementDraft[]) => {
    setDrafts(next);
    setDirty(true);
  };

  async function save() {
    const result = buildPlacementSlotPayload(drafts);
    if (!result.ok) {
      setStatus(null);
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const saved = await run(
      (idempotencyKey) =>
        replaceEditorialPlacementSlot({ slot, items: result.payload.items, idempotencyKey }),
      {
        action: "save the placements",
        success: `${PLACEMENT_SLOT_LABELS[slot]} saved (${drafts.length} row${drafts.length === 1 ? "" : "s"}).`,
      },
    );
    if (saved !== null) setDirty(false);
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-medium">
          {PLACEMENT_SLOT_LABELS[slot]}{" "}
          <span className="font-mono text-xs text-on-surface-variant">{slot}</span>
        </h2>
        {dirty ? <span className="text-xs text-on-surface-variant">Unsaved changes</span> : null}
      </div>
      {drafts.length === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="frame"
          title="Nothing placed in this slot"
        />
      ) : (
        <ol className="space-y-3">
          {drafts.map((draft, index) => (
            <PlacementRowFields
              key={draft.key}
              draft={draft}
              index={index}
              count={drafts.length}
              refLists={refLists}
              disabled={pending}
              onChange={(next) => update(replaceItem(drafts, index, next))}
              onMove={(direction) => update(moveItem(drafts, index, direction))}
              onRemove={() => update(removeItem(drafts, index))}
            />
          ))}
        </ol>
      )}
      <EditorialErrorList errors={errors} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || drafts.length >= PLACEMENT_MAX_ROWS}
          onClick={() => update([...drafts, emptyPlacementDraft(newKey())])}
        >
          Add row
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? "Saving…" : "Save slot"}
        </Button>
      </div>
      <EditorialStatusMessage status={status} />
    </section>
  );
}

export function EditorialPlacementsTab({
  placements,
  refLists,
}: {
  placements: readonly AdminPlacementRow[];
  refLists: PlacementRefLists;
}) {
  const [initial] = useState(() => placementDraftsBySlot(placements, newKey));
  return (
    <div className="space-y-6">
      <p className="text-sm text-on-surface-variant">
        Each slot is saved on its own and replaces everything in that slot. Rows show in the order
        listed.
      </p>
      {EDITORIAL_PLACEMENT_SLOTS.map((slot) => (
        <PlacementSlotEditor
          key={slot}
          slot={slot}
          initialDrafts={initial[slot]}
          refLists={refLists}
        />
      ))}
    </div>
  );
}
