"use client";

import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { FormActions, Notice, Section, StaffButton, UnsavedChangesGuard } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  lotId: string;
  initialImages: string[];
  initialAlts: (string | undefined)[];
  /** Staff who cannot edit the catalogue see the photos without the tools. */
  canEdit?: boolean;
};

/**
 * The lot's photos: upload, order (the first is the main image in listings), alt text and
 * removal, saved together. Leaving with unsaved changes asks first; a failed save stays here.
 */
export function LotImagesTabBoard({ lotId, initialImages, initialAlts, canEdit = true }: Props) {
  const router = useRouter();
  const { save, pending, lastResult, error } = useLotImagesSave(lotId);
  const [entries, setEntries] = useState<LotImageSaveEntry[]>(
    initialImages.map((key, i) => ({ key, alt: initialAlts[i] ?? "" })),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (lastResult === "ok" || lastResult === "partial") setDirty(false);
  }, [lastResult]);

  return (
    <Section
      title="Photos"
      description="The first photo is the main image in listings and the catalogue."
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Notice tone={lastResult === "partial" ? "warning" : "danger"} title={error} alert />
        ) : null}
        <LotCatalogueImagesField
          value={entries}
          onChange={(next) => {
            setEntries(next);
            setDirty(true);
          }}
          disabled={!canEdit || pending}
        />
        {canEdit && dirty ? (
          <FormActions
            start={<span className="text-staff-sm text-staff-muted">Unsaved changes</span>}
          >
            <StaffButton
              type="button"
              variant="primary"
              loading={pending}
              onClick={() => save(entries)}
            >
              Save photos
            </StaffButton>
          </FormActions>
        ) : null}
      </div>
      <UnsavedChangesGuard
        dirty={canEdit && dirty}
        label="these photos"
        navigate={router.push}
        interceptBack={false}
      />
    </Section>
  );
}
