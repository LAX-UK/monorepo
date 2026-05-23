"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { LotImageManager } from "@/components/admin/lot-image-manager";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { Button } from "@auction/ui/components/button";
import { useEffect, useState } from "react";

export type LotImageTabEntry = LotImageSaveEntry;

type Props = {
  lotId: string;
  initialImages: string[];
  initialAlts: (string | undefined)[];
};

export function LotImageTab({ lotId, initialImages, initialAlts }: Props) {
  const { save, pending, lastResult } = useLotImagesSave(lotId);
  const [entries, setEntries] = useState<LotImageTabEntry[]>(
    initialImages.map((key, i) => ({ key, alt: initialAlts[i] ?? "" })),
  );
  const [dirty, setDirty] = useState(false);

  function handleChange(next: LotImageTabEntry[]) {
    setEntries(next);
    setDirty(true);
  }

  useEffect(() => {
    if (lastResult === "ok" || lastResult === "partial") setDirty(false);
  }, [lastResult]);

  function handleSave() {
    save(entries);
  }

  return (
    <CatalogDetailTabPanel
      title="Images"
      description="Upload, reorder, and caption lot images. The first image is used as the catalogue hero."
      framed={false}
    >
      {entries.length === 0 ? (
        <AdminEmptyState
          title="No images yet"
          description="Add at least one image before publishing this lot."
        />
      ) : null}
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <LotImageManager value={entries} onChange={handleChange} disabled={pending} />
      </div>
      {dirty ? (
        <Button type="button" onClick={handleSave} disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Save image changes"}
        </Button>
      ) : null}
    </CatalogDetailTabPanel>
  );
}
