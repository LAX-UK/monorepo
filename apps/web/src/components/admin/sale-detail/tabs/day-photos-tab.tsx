"use client";

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import type { SaleDayMediaRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { DayMediaCard } from "./day-photos/day-media-card";
import { DayPhotosNotEndedBanner } from "./day-photos/day-photos-not-ended-banner";
import { DayPhotosUploadTriggers } from "./day-photos/day-photos-upload-triggers";
import { useDayPhotosTab } from "./day-photos/use-day-photos-tab";

type Props = {
  saleId: string;
  saleStatus: string;
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
  canManage: boolean;
};

export function SaleDayPhotosTab(props: Props) {
  const {
    items,
    setItems,
    saving,
    isEnded,
    canManage,
    dirty,
    sensors,
    uploadFiles,
    handleSave,
    handleRemoveConfirmed,
    anyUploading,
  } = useDayPhotosTab(props);

  return (
    <CatalogDetailTabPanel
      title="Auction day media"
      description="Upload event photos and short video clips from the saleroom floor. Once the sale has ended, removing an item saves immediately; use Save media for caption or order changes."
      framed={false}
    >
      {!isEnded ? <DayPhotosNotEndedBanner /> : null}

      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        {canManage ? (
          <DayPhotosUploadTriggers
            disabled={saving || anyUploading}
            onFilesSelected={uploadFiles}
          />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="No auction day media yet"
            description="Upload photos and short video clips from the event, then drag to reorder."
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (over && active.id !== over.id) {
                setItems((prev) => {
                  const from = prev.findIndex((it) => it.id === active.id);
                  const to = prev.findIndex((it) => it.id === over.id);
                  return arrayMove(prev, from, to);
                });
              }
            }}
          >
            <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
              <ol className="space-y-2 list-none p-0" aria-live="polite">
                {items.map((item, index) => (
                  <DayMediaCard
                    key={item.id}
                    item={item}
                    index={index}
                    disabled={!canManage || saving}
                    removeConfirmTitle={
                      isEnded ? "Remove from public gallery?" : "Remove from draft list?"
                    }
                    removeConfirmBody={
                      isEnded
                        ? "Remove this item from the public gallery? This cannot be undone."
                        : "Remove this item from your draft list? You can re-upload before the sale ends."
                    }
                    onRemoveConfirmed={() => handleRemoveConfirmed(item.id)}
                    onCaptionChange={(v) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, caption: v } : it)),
                      )
                    }
                    onAltChange={(v) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, alt: v } : it)),
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {canManage ? (
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-hairline pt-5">
            <p className="font-body text-xs text-on-surface-variant">
              {items.length} item{items.length !== 1 ? "s" : ""}
              {anyUploading ? " · Uploading…" : ""}
              {dirty && isEnded && !saving ? " · Unsaved changes" : ""}
              {saving ? " · Saving…" : ""}
            </p>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !dirty || anyUploading || !isEnded}
              variant="cta"
              size="sm"
              title={!isEnded ? "Available once the sale has ended" : undefined}
            >
              {saving ? "Saving…" : "Save media"}
            </Button>
          </div>
        ) : null}
      </div>
    </CatalogDetailTabPanel>
  );
}
