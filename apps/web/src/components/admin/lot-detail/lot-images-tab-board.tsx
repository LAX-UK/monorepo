"use client";

import { DetailBoardKpiStrip } from "@/components/admin/catalog/detail-board";
import {
  CatalogMediaCollectionActions,
  CatalogMediaWorkspace,
} from "@/components/admin/catalog/media";
import { LotImageManager } from "@/components/admin/lot-image-manager";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import { buildLotImagesKpiTiles } from "@/lib/data/view-models/lot-images-tab.vm";
import { Button } from "@auction/ui/components/button";
import { useEffect, useMemo, useState } from "react";

type Props = {
  lotId: string;
  initialImages: string[];
  initialAlts: (string | undefined)[];
};

export function LotImagesTabBoard({ lotId, initialImages, initialAlts }: Props) {
  const { save, pending, lastResult } = useLotImagesSave(lotId);
  const [entries, setEntries] = useState<LotImageSaveEntry[]>(
    initialImages.map((key, i) => ({ key, alt: initialAlts[i] ?? "" })),
  );
  const [dirty, setDirty] = useState(false);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  const {
    showAdd,
    showManage,
    addButtonRef,
    manageButtonRef,
    closeAddPanel,
    toggleAdd,
    toggleManage,
  } = useMediaCollectionUi({
    collectionLength: entries.length,
    inspectTarget: inspectIndex,
    setInspectTarget: setInspectIndex,
  });

  const kpiTiles = useMemo(() => buildLotImagesKpiTiles(entries.length), [entries.length]);

  function handleChange(next: LotImageSaveEntry[]) {
    setEntries(next);
    setDirty(true);
  }

  useEffect(() => {
    if (lastResult === "ok" || lastResult === "partial") setDirty(false);
  }, [lastResult]);

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Image summary" tiles={kpiTiles} />
      <CatalogMediaWorkspace
        title="Images"
        description="Upload, reorder, and describe lot images. The catalogue hero is always shown first."
        count={entries.length}
        actions={
          <CatalogMediaCollectionActions
            addButtonRef={addButtonRef}
            manageButtonRef={manageButtonRef}
            showAdd={showAdd}
            showManage={showManage}
            onToggleAdd={toggleAdd}
            onToggleManage={toggleManage}
            addLabel="Add images"
            manageLabel="Manage"
          />
        }
        saveBar={
          dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-on-surface-variant">
                You have unsaved image changes.
              </p>
              <Button
                type="button"
                onClick={() => save(entries)}
                disabled={pending}
                size="sm"
                variant="cta"
              >
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : undefined
        }
        footer={
          <span aria-live="polite">
            {entries.length} image{entries.length === 1 ? "" : "s"}
            {pending ? " · Saving…" : dirty ? " · Unsaved changes" : " · All changes saved"}
          </span>
        }
      >
        <LotImageManager
          value={entries}
          onChange={handleChange}
          disabled={pending}
          showAddPanel={showAdd}
          onCloseAddPanel={closeAddPanel}
          showManage={showManage}
          inspectIndex={inspectIndex}
          onInspectIndex={setInspectIndex}
        />
      </CatalogMediaWorkspace>
    </div>
  );
}
