"use client";

import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { CoverPreviews } from "@/components/admin/sale-cover/cover-previews";
import { CoverSlotPanel } from "@/components/admin/sale-cover/cover-slot-panel";
import { CoverSlotTabs, slotTabId } from "@/components/admin/sale-cover/cover-slot-tabs";
import { FeaturedLotsEditor } from "@/components/admin/sale-cover/featured-lots-editor";
import { HomeControls } from "@/components/admin/sale-cover/home-controls";
import { useCoverDraft } from "@/components/admin/sale-cover/use-cover-draft";
import { measureState } from "@/lib/admin/sale-cover/cover-previews";
import type { CoverLotOption, CoverView } from "@/lib/admin/sale-cover/cover-view";
import { slotSummary } from "@/lib/admin/sale-cover/slot-summary";
import { FormActions, Notice, Section, StaffButton, StaffReadOnly } from "@auction/staff-ui";
import { SALE_COVER_SLOT_NAMES, type SaleCoverSlotName, type SaleStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  saleStatus: SaleStatus;
  view: CoverView;
  lots: readonly CoverLotOption[];
  /** The viewer may change the sale's cover (sales access); otherwise it is a read-only view. */
  canEdit: boolean;
};

/** How often to read the sale again while a picture is being measured, and for how long. */
const ANALYSIS_POLL_MS = 4000;
const ANALYSIS_POLL_LIMIT = 30;

function useAnalysisPolling(pending: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      router.refresh();
      if (polls >= ANALYSIS_POLL_LIMIT) clearInterval(timer);
    }, ANALYSIS_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, router]);
}

/**
 * The sale's home cover: three named pictures, each with a focal point and an area to keep in
 * frame, the three crops they make, the measured text settings, the featured lots and the home
 * pin, subtitle and consigning deadline. Changes are held until Save, and leaving with unsaved
 * changes asks first.
 */
export function SaleCoverTab({ saleId, saleTitle, saleStatus, view, lots, canEdit }: Props) {
  const panelId = useId();
  const {
    draft,
    dirty,
    saving,
    saveError,
    blockers,
    blocked,
    setSlot,
    patchSlot,
    patchHome,
    discard,
    save,
  } = useCoverDraft({ saleId, view, lots });
  const [selected, setSelected] = useState<SaleCoverSlotName>("default");

  const phoneSlotPresent = draft.slots.phone !== undefined;
  const summaries = useMemo(
    () =>
      Object.fromEntries(
        SALE_COVER_SLOT_NAMES.map((name) => [
          name,
          slotSummary(name, draft.slots[name], view.slots[name], lots, phoneSlotPresent),
        ]),
      ) as Record<SaleCoverSlotName, ReturnType<typeof slotSummary>>,
    [draft.slots, view.slots, lots, phoneSlotPresent],
  );

  const pending = SALE_COVER_SLOT_NAMES.some((name) => {
    const state = view.slots[name]?.analysis.status;
    return view.slots[name]?.source === "slot" && state === "pending";
  });
  useAnalysisPolling(pending);

  const coverLotId =
    draft.slots.default?.source.kind === "lot" ? draft.slots.default.source.lotId : null;
  const firstBlocker = SALE_COVER_SLOT_NAMES.map((name) => blockers[name]?.[0]).find(Boolean);

  return (
    <StaffReadOnly readOnly={!canEdit}>
      <FormDirtyGuard isDirty={dirty} label="the cover and home settings" />
      <div className="flex flex-col gap-6">
        {!canEdit ? (
          <Notice tone="info" title="You can look at the cover but not change it">
            Changing the home cover needs access to sales.
          </Notice>
        ) : null}
        {saveError ? (
          <Notice tone="danger" alert title="Your changes were not saved">
            {saveError}
          </Notice>
        ) : null}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Section
              title="Cover"
              description="What the home hero and the sale page show."
              bodyClassName="flex flex-col gap-4"
            >
              <CoverSlotTabs
                summaries={summaries}
                selected={selected}
                onSelect={setSelected}
                panelId={panelId}
              />
              <div
                role="tabpanel"
                id={panelId}
                aria-labelledby={slotTabId(panelId, selected)}
                tabIndex={-1}
              >
                <CoverSlotPanel
                  key={selected}
                  name={selected}
                  draft={draft.slots[selected]}
                  saved={view.slots[selected]}
                  lots={lots}
                  phoneSlotPresent={phoneSlotPresent}
                  measure={measureState(selected, draft.slots[selected], view.slots[selected])}
                  canEdit={canEdit}
                  onSet={(next) => setSlot(selected, next)}
                  onPatch={(patch) => patchSlot(selected, patch)}
                />
              </div>
            </Section>

            <FeaturedLotsEditor
              lots={lots}
              featuredLotIds={draft.home.featuredLotIds}
              coverLotId={coverLotId}
              canEdit={canEdit}
              onChange={(featuredLotIds) => patchHome({ featuredLotIds })}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Section
              title="Preview"
              description="With the text zone."
              action={
                pending ? <span className="text-staff-sm text-staff-muted">Analysing…</span> : null
              }
            >
              <CoverPreviews slots={draft.slots} view={view} />
            </Section>
            <HomeControls
              view={view}
              home={draft.home}
              saleTitle={saleTitle}
              saleStatus={saleStatus}
              canEdit={canEdit}
              onChange={patchHome}
            />
          </div>
        </div>

        {canEdit ? (
          <FormActions
            sticky
            start={
              <output className="text-staff-sm text-staff-muted">
                {saving
                  ? "Saving…"
                  : blocked
                    ? (firstBlocker ?? "Fix the highlighted picture to save.")
                    : dirty
                      ? "You have unsaved changes."
                      : "All changes saved."}
              </output>
            }
          >
            <StaffButton variant="secondary" disabled={!dirty || saving} onClick={discard}>
              Discard changes
            </StaffButton>
            <StaffButton
              variant="primary"
              loading={saving}
              {...(blocked
                ? { disabledReason: firstBlocker ?? "Fix the highlighted picture to save." }
                : { disabled: !dirty })}
              onClick={() => void save()}
            >
              Save changes
            </StaffButton>
          </FormActions>
        ) : null}
      </div>
    </StaffReadOnly>
  );
}
