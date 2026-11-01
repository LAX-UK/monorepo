"use client";

import { StaffSingleImage } from "@/components/admin/media/staff-single-image";
import { FocalKeepEditor } from "@/components/admin/sale-cover/focal-keep-editor";
import { LotPhotoDialog } from "@/components/admin/sale-cover/lot-photo-dialog";
import { measurePicture } from "@/components/admin/sale-cover/measure-picture";
import { MediaImage } from "@/components/ui/media-image";
import {
  type CoverSource,
  type SlotDraft,
  type SlotPatch,
  describeSlotIssue,
  missingAltMessage,
  newSlotDraft,
  slotIssues,
} from "@/lib/admin/sale-cover/cover-draft";
import type { MeasureState } from "@/lib/admin/sale-cover/cover-previews";
import {
  type CoverLotOption,
  type CoverSlotView,
  lotLabel,
} from "@/lib/admin/sale-cover/cover-view";
import { suggestCoverSide } from "@auction/domain";
import { COVER_ZOOM_MAX, COVER_ZOOM_MIN } from "@auction/domain";
import { Field, Notice, SegmentedControl, StaffButton, TextInput } from "@auction/staff-ui";
import type { CoverTextSide, CoverTextTone, SaleCoverSlotName } from "@auction/types";
import { useState } from "react";
import { ZoomStepper } from "./zoom-stepper";

type Props = {
  name: SaleCoverSlotName;
  draft: SlotDraft | undefined;
  /** What the server holds for this slot, for the old-array notice. */
  saved: CoverSlotView | undefined;
  lots: readonly CoverLotOption[];
  phoneSlotPresent: boolean;
  measure: MeasureState;
  canEdit: boolean;
  onSet: (draft: SlotDraft | null) => void;
  onPatch: (patch: SlotPatch) => void;
};

const ALT_MAX = 300;

type Zoomed = "whole" | "detail";
const DETAIL_START_ZOOM = 1.5;

const TONE_LABEL: Record<CoverTextTone, string> = { light: "white", dark: "dark" };
const TONE_NAME: Record<CoverTextTone, string> = { light: "White", dark: "Dark" };
const SIDE_NAME: Record<CoverTextSide, string> = { left: "Left", right: "Right" };

/** A chosen option shown as plain text, at normal contrast, when the slot cannot be changed. */
function ChosenValue({ children }: { children: React.ReactNode }) {
  return <p className="text-staff-sm text-staff-fg">{children}</p>;
}

function sourceSummary(draft: SlotDraft, lots: readonly CoverLotOption[]): string {
  if (draft.source.kind === "upload") return "An uploaded picture";
  const lotId = draft.source.lotId;
  const lot = lots.find((candidate) => candidate.id === lotId);
  return lot ? lotLabel(lot) : "A lot in this sale";
}

/** The editor for one cover slot: where its picture comes from, how it is framed, and its text. */
export function CoverSlotPanel({
  name,
  draft,
  saved,
  lots,
  phoneSlotPresent,
  measure,
  canEdit,
  onSet,
  onPatch,
}: Props) {
  const [mode, setMode] = useState<"summary" | "upload">("summary");
  const [lotDialog, setLotDialog] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  const take = async (source: CoverSource, key: string) => {
    setMeasuring(true);
    try {
      onSet(newSlotDraft(source, key, await measurePicture(key)));
      setMode("summary");
      setLotDialog(false);
    } finally {
      setMeasuring(false);
    }
  };

  const showUpload = !draft || mode === "upload";
  const issues = draft ? slotIssues(name, draft, phoneSlotPresent) : [];
  const altError = draft ? missingAltMessage(draft) : null;
  const zoomed: Zoomed = draft && draft.zoom > COVER_ZOOM_MIN ? "detail" : "whole";
  const textOnPicture = name !== "phone";

  return (
    <div className="flex flex-col gap-4">
      {!draft && saved?.source === "legacy" ? (
        <Notice tone="info" title="This slot still shows a picture from the old cover list">
          Choose a picture here to set its focal point and text settings. Until then the old picture
          is used as it is.
        </Notice>
      ) : null}

      {showUpload ? (
        <div className="flex flex-col gap-3">
          <StaffSingleImage
            kind="sale_cover"
            value={null}
            onChange={(key) => {
              if (key) void take({ kind: "upload", key }, key);
            }}
            noun={`${name} cover picture`}
            disabled={!canEdit || measuring}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StaffButton
              variant="secondary"
              size="sm"
              disabled={!canEdit || measuring}
              onClick={() => setLotDialog(true)}
            >
              Use a lot photo
            </StaffButton>
            {draft ? (
              <StaffButton variant="ghost" size="sm" onClick={() => setMode("summary")}>
                Keep the current picture
              </StaffButton>
            ) : null}
          </div>
        </div>
      ) : null}

      {draft && !showUpload ? (
        <>
          <FocalKeepEditor
            pictureKey={draft.pictureKey}
            size={draft.size}
            focal={draft.focal}
            keep={draft.keep}
            onFocalChange={(focal) => onPatch({ focal })}
            onKeepChange={(keep) => onPatch({ keep })}
            label={`${name} cover picture`}
            disabled={!canEdit}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-staff-sm text-staff-muted">
              {zoomed === "detail"
                ? "The credit says “(detail)” because the picture is zoomed in."
                : "The whole picture is shown."}
            </p>
            {canEdit ? (
              <SegmentedControl<Zoomed>
                label="Picture zoom"
                value={zoomed}
                onValueChange={(next) =>
                  onPatch({ zoom: next === "whole" ? COVER_ZOOM_MIN : DETAIL_START_ZOOM })
                }
                options={[
                  { value: "whole", label: "Whole work" },
                  { value: "detail", label: `Detail × ${draft.zoom.toFixed(1)}` },
                ]}
              />
            ) : null}
          </div>
          {zoomed === "detail" && canEdit ? (
            <ZoomStepper
              value={draft.zoom}
              min={COVER_ZOOM_MIN}
              max={COVER_ZOOM_MAX}
              disabled={!canEdit}
              onChange={(zoom) => onPatch({ zoom })}
            />
          ) : null}

          {issues.map((issue) => (
            <Notice
              key={`${issue.code}-${issue.code === "keep_area_cut" ? issue.box : "size"}`}
              tone={issue.code === "below_floor" ? "danger" : "warning"}
              title={describeSlotIssue(name, issue)}
            />
          ))}

          <div className="flex flex-col gap-4">
            <Field label="This cover shows">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-staff-md border border-staff-line px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-10 shrink-0 overflow-hidden rounded-staff-xs bg-staff-sunken">
                    <MediaImage
                      src={draft.pictureKey}
                      alt=""
                      label="Cover"
                      imgClassName="size-full object-cover"
                      sizes="40px"
                    />
                  </span>
                  <span className="min-w-0 truncate text-staff-sm font-medium text-staff-fg">
                    {sourceSummary(draft, lots)}
                  </span>
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap gap-1">
                    <StaffButton size="sm" variant="secondary" onClick={() => setLotDialog(true)}>
                      Use a lot photo
                    </StaffButton>
                    <StaffButton size="sm" variant="secondary" onClick={() => setMode("upload")}>
                      Upload instead
                    </StaffButton>
                    <StaffButton size="sm" variant="ghost" onClick={() => onSet(null)}>
                      Remove
                    </StaffButton>
                  </div>
                ) : null}
              </div>
            </Field>
            <Field
              label="Alt text"
              description="Read by screen readers. Describe the picture, not the sale."
              error={altError}
            >
              <TextInput
                value={draft.alt}
                maxLength={ALT_MAX}
                disabled={!canEdit}
                onChange={(event) => onPatch({ alt: event.target.value })}
              />
            </Field>
          </div>

          {textOnPicture ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Text tone" optional>
                <ToneControl
                  draft={draft}
                  measure={measure}
                  disabled={!canEdit}
                  onPatch={onPatch}
                />
              </Field>
              <Field label="Text side" optional>
                <SideControl draft={draft} disabled={!canEdit} onPatch={onPatch} />
              </Field>
            </div>
          ) : null}
        </>
      ) : null}

      <LotPhotoDialog
        open={lotDialog}
        onOpenChange={setLotDialog}
        lots={lots}
        busy={measuring}
        onChoose={({ lotId, imageIndex, key }) =>
          void take({ kind: "lot", lotId, imageIndex }, key)
        }
      />
    </div>
  );
}

type TextControlProps = {
  draft: SlotDraft;
  disabled: boolean;
  onPatch: (patch: SlotPatch) => void;
};

function ToneControl({
  draft,
  measure,
  disabled,
  onPatch,
}: TextControlProps & { measure: MeasureState }) {
  const lead =
    measure.kind === "ready"
      ? (measure.analysis.breakpoints.desktop ?? measure.analysis.breakpoints.wide)
      : undefined;
  const recommended = lead?.recommended ?? null;
  const strength = recommended ? lead?.[recommended]?.strength : undefined;
  const autoLabel =
    recommended && strength !== undefined
      ? `Auto · ${TONE_LABEL[recommended]}, ${strength.toFixed(2)}`
      : measure.kind === "pending"
        ? "Auto · analysing…"
        : "Auto";
  if (disabled) {
    return (
      <ChosenValue>{draft.toneOverride ? TONE_NAME[draft.toneOverride] : autoLabel}</ChosenValue>
    );
  }
  return (
    <SegmentedControl<"auto" | CoverTextTone>
      label="Text tone"
      size="md"
      value={draft.toneOverride ?? "auto"}
      onValueChange={(next) => onPatch({ toneOverride: next === "auto" ? undefined : next })}
      options={[
        { value: "auto", label: autoLabel },
        { value: "light", label: "White" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}

function SideControl({ draft, disabled, onPatch }: TextControlProps) {
  const suggested = suggestCoverSide(draft.focal);
  if (disabled) {
    return (
      <ChosenValue>
        {draft.sideOverride ? SIDE_NAME[draft.sideOverride] : `Auto · ${suggested}`}
      </ChosenValue>
    );
  }
  return (
    <SegmentedControl<"auto" | CoverTextSide>
      label="Text side"
      size="md"
      value={draft.sideOverride ?? "auto"}
      onValueChange={(next) => onPatch({ sideOverride: next === "auto" ? undefined : next })}
      options={[
        { value: "auto", label: `Auto · ${suggested}` },
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]}
    />
  );
}
