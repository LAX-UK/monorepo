"use client";

import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
import type { EditorialAdminRow } from "@/lib/editorial-entity-forms";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import {
  type AdminPlacementRow,
  EDITORIAL_PLACEMENT_SLOTS,
  type EditorialPlacementSlot,
  PLACEMENT_MAX_ROWS,
  PLACEMENT_REF_KINDS,
  PLACEMENT_REF_KIND_COPY,
  PLACEMENT_SLOT_LABELS,
  type PlacementDraft,
  type PlacementField,
  type PlacementIssue,
  type PlacementRefKind,
  buildPlacementSlotPayload,
  emptyPlacementDraft,
  placementDraftsBySlot,
} from "@/lib/editorial-placements";
import { replaceEditorialPlacementSlot } from "@/server/application/admin-editorial-actions.server";
import {
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  ListEditor,
  Notice,
  StaffButton,
  StaffReadOnly,
  StatusBadge,
  TextInput,
  useBeforeUnloadGuard,
  useStaffCan,
} from "@auction/staff-ui";
import { Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";

export type PlacementRefLists = Record<
  Exclude<PlacementRefKind, "external">,
  readonly EditorialAdminRow[]
>;

const newKey = () => crypto.randomUUID();

const REF_KIND_OPTIONS = PLACEMENT_REF_KINDS.map((kind) => ({
  value: kind,
  label: PLACEMENT_REF_KIND_COPY[kind].label,
}));

const HREF_PLACEHOLDER = "https://… or /visit";

const fieldId = (slot: string, rowKey: string, field: string) =>
  `placement-${slot}-${rowKey}-${field}`;

function PlacementRowFields({
  slot,
  draft,
  refLists,
  disabled,
  errors,
  onChange,
}: {
  slot: EditorialPlacementSlot;
  draft: PlacementDraft;
  refLists: PlacementRefLists;
  disabled: boolean;
  errors: Partial<Record<PlacementField, string>>;
  onChange: (next: PlacementDraft) => void;
}) {
  const copy = PLACEMENT_REF_KIND_COPY[draft.refKind];
  const refRows = draft.refKind === "external" ? [] : refLists[draft.refKind];
  const refOptions = refRows.map((row) => ({
    value: row.id,
    label: `${row.label}${row.status === "draft" ? " (draft)" : ""}`,
  }));
  if (draft.refId && !refRows.some((row) => row.id === draft.refId)) {
    refOptions.push({ value: draft.refId, label: "Unknown item (removed?)" });
  }
  const external = draft.refKind === "external";
  return (
    <>
      <FieldRow>
        <Field label="Links to" disabled={disabled}>
          <EnumSelect
            value={draft.refKind}
            options={REF_KIND_OPTIONS}
            onValueChange={(refKind) => onChange({ ...draft, refKind, refId: "" })}
          />
        </Field>
        {external ? null : (
          <Field
            label={`Featured ${copy.noun}`}
            disabled={disabled}
            error={errors.refId}
            id={fieldId(slot, draft.key, "refId")}
          >
            <EnumSelect
              value={draft.refId || null}
              options={refOptions}
              placeholder={copy.choose}
              onValueChange={(refId) => onChange({ ...draft, refId })}
            />
          </Field>
        )}
      </FieldRow>
      <FieldRow>
        <Field label="Headline" optional disabled={disabled}>
          <TextInput
            value={draft.headline}
            maxLength={300}
            autoComplete="off"
            onChange={(event) => onChange({ ...draft, headline: event.target.value })}
          />
        </Field>
        <Field
          label="Link URL"
          optional={!external}
          disabled={disabled}
          error={errors.linkUrl}
          id={fieldId(slot, draft.key, "linkUrl")}
        >
          <TextInput
            value={draft.linkUrl}
            placeholder={HREF_PLACEHOLDER}
            maxLength={2048}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...draft, linkUrl: event.target.value })}
          />
        </Field>
      </FieldRow>
      <EditorialImageField
        name={fieldId(slot, draft.key, "image")}
        label="Image"
        kind="editorial_cover"
        value={draft.mediaKey}
        disabled={disabled}
        onChange={(mediaKey) => onChange({ ...draft, mediaKey })}
      />
    </>
  );
}

function issuesByRow(issues: readonly PlacementIssue[]) {
  const byRow = new Map<string, Partial<Record<PlacementField, string>>>();
  for (const issue of issues) {
    if (!issue.rowKey || !issue.field) continue;
    byRow.set(issue.rowKey, { ...byRow.get(issue.rowKey), [issue.field]: issue.message });
  }
  return byRow;
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
  const readOnly = !useStaffCan("editorial.write");
  const [drafts, setDrafts] = useState(initialDrafts);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<PlacementIssue[]>([]);
  const [failedSaves, setFailedSaves] = useState(0);
  useBeforeUnloadGuard(dirty);
  const headingId = `placement-${slot}-heading`;
  const rowErrors = issuesByRow(issues);

  const update = (next: PlacementDraft[]) => {
    setDrafts(next);
    setDirty(true);
    if (issues.length > 0) setIssues([]);
  };

  async function save() {
    const result = buildPlacementSlotPayload(drafts);
    if (!result.ok) {
      setStatus(null);
      setIssues(result.issues);
      setFailedSaves((count) => count + 1);
      return;
    }
    setIssues([]);
    const saved = await run(
      (idempotencyKey) =>
        replaceEditorialPlacementSlot({ slot, items: result.payload.items, idempotencyKey }),
      {
        action: "save the placements",
        success: `${PLACEMENT_SLOT_LABELS[slot]} saved (${drafts.length} ${drafts.length === 1 ? "row" : "rows"})`,
      },
    );
    if (saved !== null) setDirty(false);
  }

  const summary = issues.map((issue) => {
    const position = drafts.findIndex((draft) => draft.key === issue.rowKey) + 1;
    return {
      fieldId: issue.rowKey && issue.field ? fieldId(slot, issue.rowKey, issue.field) : headingId,
      message: issue.rowKey ? `Row ${position}: ${issue.message}` : issue.message,
    };
  });

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={headingId}
          tabIndex={-1}
          className="staff-focus rounded-staff-xs font-staff text-staff-md font-semibold text-staff-fg"
        >
          {PLACEMENT_SLOT_LABELS[slot]}
        </h2>
        {dirty ? <StatusBadge tone="warning">Unsaved changes</StatusBadge> : null}
      </div>
      <FormErrorSummary errors={summary} focusKey={failedSaves} />
      <StaffReadOnly readOnly={readOnly}>
        <ListEditor
          items={drafts}
          getKey={(draft) => draft.key}
          itemLabel={(index) => `row ${index + 1}`}
          addLabel="Add row"
          emptyText="Nothing is placed in this slot."
          max={PLACEMENT_MAX_ROWS}
          disabled={pending}
          readOnly={readOnly}
          onAdd={() => update([...drafts, emptyPlacementDraft(newKey())])}
          onRemove={(index) => update(removeItem(drafts, index))}
          onMove={(from, to) => update(moveItem(drafts, from, to > from ? 1 : -1))}
          renderItem={(draft, index) => (
            // biome-ignore lint/a11y/useSemanticElements: a row is several fields, not one control
            <div role="group" aria-label={`Row ${index + 1}`} className="flex flex-col gap-4">
              <PlacementRowFields
                slot={slot}
                draft={draft}
                refLists={refLists}
                disabled={pending}
                errors={rowErrors.get(draft.key) ?? {}}
                onChange={(next) => update(replaceItem(drafts, index, next))}
              />
            </div>
          )}
        />
      </StaffReadOnly>
      {status ? (
        <Notice
          tone="danger"
          alert
          title={status.text}
          {...(status.stepUp
            ? {
                actions: (
                  <StaffButton asChild size="sm" variant="secondary">
                    <Link href="/api/auth/login?returnTo=%2Feditorial%2Fhome">Sign in again</Link>
                  </StaffButton>
                ),
              }
            : {})}
        />
      ) : null}
      {readOnly ? null : (
        <FormActions>
          <StaffButton
            type="button"
            variant="primary"
            icon={<Save aria-hidden />}
            {...(dirty || pending ? {} : { disabledReason: "No changes to save" })}
            loading={pending}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Save slot"}
          </StaffButton>
        </FormActions>
      )}
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
  // Saved rows get stable keys: their ids appear in the markup, so the server and the browser must agree.
  const [initial] = useState(() => {
    let next = 0;
    return placementDraftsBySlot(placements, () => `saved-${next++}`);
  });
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-6">
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
