"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  DetailBoardKpiStrip,
  DetailBoardToolbar,
  DetailNoticeBanner,
} from "@/components/admin/catalog/detail-board";
import {
  CatalogMediaAddPanel,
  CatalogMediaCollectionActions,
  CatalogMediaInspector,
  CatalogMediaWorkspace,
  MediaReorderLiveRegion,
  useMediaReorderAnnouncement,
} from "@/components/admin/catalog/media";
import { MediaImage } from "@/components/ui/media-image";
import { downloadSaleMediaCsv } from "@/lib/admin/export-sale-media-csv";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import {
  SALE_MEDIA_FILTERS,
  type SaleMediaFilter,
  buildSaleMediaKpiTiles,
  filterSaleMediaItems,
  matchesSaleMediaSearch,
} from "@/lib/data/view-models/sale-media-tab.vm";
import type { SaleDayMediaRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { DayMediaCard } from "./day-photos/day-media-card";
import { DayPhotosUploadTriggers } from "./day-photos/day-photos-upload-triggers";
import { useDayPhotosTab } from "./day-photos/use-day-photos-tab";

type Props = {
  saleId: string;
  saleTitle: string;
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

  const [filter, setFilter] = useState<SaleMediaFilter>("all");
  const [search, setSearch] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const { message, announceMove } = useMediaReorderAnnouncement();
  const {
    showAdd,
    showManage,
    setShowManage,
    addButtonRef,
    manageButtonRef,
    addPanelRef,
    closeAddPanel,
    toggleAdd,
    toggleManage,
  } = useMediaCollectionUi({
    collectionLength: items.length,
    inspectTarget: inspectId,
    setInspectTarget: setInspectId,
  });
  const isPublished = isEnded;
  const reorderFiltered = filter !== "all" || search.trim().length > 0;

  useEffect(() => {
    if (reorderFiltered) setShowManage(false);
  }, [reorderFiltered, setShowManage]);

  const visibleItems = useMemo(
    () =>
      filterSaleMediaItems(items, filter, isPublished).filter((item) =>
        matchesSaleMediaSearch(
          item.mediaType === "video"
            ? {
                mediaType: "video",
                key: item.key,
                ...(item.caption.trim() ? { caption: item.caption.trim() } : {}),
              }
            : {
                key: item.key,
                ...(item.caption.trim() ? { caption: item.caption.trim() } : {}),
                ...(item.alt.trim() ? { alt: item.alt.trim() } : {}),
              },
          search,
        ),
      ),
    [items, filter, isPublished, search],
  );

  const moveItem = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    announceMove(`media item ${index + 1}`, index, target);
    setItems((prev) => arrayMove(prev, index, target));
  };

  const inspectedItem = inspectId ? items.find((item) => item.id === inspectId) : null;
  const inspectedIndex = inspectedItem ? items.findIndex((item) => item.id === inspectId) : -1;

  return (
    <div className="space-y-6">
      {!isEnded ? (
        <DetailNoticeBanner
          title="Draft mode"
          message="Media uploaded before the auction ends remains internal. Publishing becomes available once the sale is completed."
        />
      ) : null}

      <DetailBoardKpiStrip ariaLabel="Media summary" tiles={buildSaleMediaKpiTiles(items)} />

      <CatalogMediaWorkspace
        title="Media"
        description="Event photos and short video clips from the saleroom floor."
        count={visibleItems.length}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5"
              disabled={items.length === 0}
              onClick={() => downloadSaleMediaCsv(items, props.saleTitle)}
            >
              Export
            </Button>
            {canManage ? (
              <CatalogMediaCollectionActions
                addButtonRef={addButtonRef}
                manageButtonRef={manageButtonRef}
                showAdd={showAdd}
                showManage={showManage}
                onToggleAdd={toggleAdd}
                onToggleManage={toggleManage}
                addLabel="Add media"
                manageLabel="Manage"
                manageDisabled={reorderFiltered}
              />
            ) : null}
          </>
        }
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search media…"
            filters={SALE_MEDIA_FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            filterAriaLabel="Filter media"
            trailing={
              reorderFiltered ? (
                <span className="font-body text-xs text-on-surface-variant">
                  Clear filters to reorder.
                </span>
              ) : null
            }
          />
        }
        addPanel={
          canManage && showAdd ? (
            <CatalogMediaAddPanel
              panelRef={addPanelRef}
              title="Add media"
              description="Upload photos or short video clips from the saleroom floor."
              onCancel={closeAddPanel}
            >
              <DayPhotosUploadTriggers
                disabled={saving || anyUploading}
                onFilesSelected={uploadFiles}
              />
            </CatalogMediaAddPanel>
          ) : undefined
        }
        liveRegion={<MediaReorderLiveRegion message={message} />}
        saveBar={
          dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isEnded ? (
                <>
                  <p className="font-body text-sm text-on-surface-variant">
                    You have unsaved media changes.
                  </p>
                  <Button
                    onClick={() => void handleSave()}
                    disabled={saving || anyUploading}
                    variant="cta"
                    size="sm"
                  >
                    {saving ? "Saving…" : "Save media"}
                  </Button>
                </>
              ) : (
                <p className="font-body text-sm text-on-surface-variant">
                  Draft changes are kept only on this page and are discarded if you navigate away.
                  Publishing becomes available once the sale ends.
                </p>
              )}
            </div>
          ) : undefined
        }
        footer={
          <span aria-live="polite">
            {`Showing ${visibleItems.length} of ${items.length}`}
            {anyUploading ? " · Uploading…" : ""}
            {dirty && !saving ? " · Unsaved changes" : ""}
            {saving ? " · Saving…" : ""}
          </span>
        }
      >
        {items.length === 0 && !showAdd ? (
          canManage ? (
            <AdminEmptyState
              title="No auction day media yet"
              description="Add photos or short video clips from the saleroom floor."
              action={
                <Button type="button" size="sm" onClick={toggleAdd}>
                  Add your first media
                </Button>
              }
            />
          ) : (
            <AdminEmptyState
              title="No auction day media yet"
              description="Auction day photos and videos will appear here."
            />
          )
        ) : visibleItems.length === 0 ? (
          <AdminEmptyState
            title="No matching media"
            description="Try a different search or filter."
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              if (!showManage) return;
              const { active, over } = event;
              if (over && active.id !== over.id) {
                setItems((prev) => {
                  const from = prev.findIndex((it) => it.id === active.id);
                  const to = prev.findIndex((it) => it.id === over.id);
                  if (from >= 0 && to >= 0) announceMove(`media item ${from + 1}`, from, to);
                  return arrayMove(prev, from, to);
                });
              }
            }}
          >
            <SortableContext items={visibleItems.map((it) => it.id)} strategy={rectSortingStrategy}>
              <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => {
                  const itemIndex = items.findIndex((it) => it.id === item.id);
                  return (
                    <DayMediaCard
                      key={item.id}
                      item={item}
                      index={itemIndex}
                      showManage={showManage}
                      published={isPublished}
                      disabled={!canManage || saving}
                      isLast={itemIndex === items.length - 1}
                      isSelected={inspectId === item.id}
                      removeConfirmTitle={
                        isEnded ? "Remove from public gallery?" : "Remove from draft list?"
                      }
                      removeConfirmBody={
                        isEnded
                          ? "Remove this item from the public gallery? This cannot be undone."
                          : "Remove this item from your draft list? You can re-upload before the sale ends."
                      }
                      onRemoveConfirmed={() => handleRemoveConfirmed(item.id)}
                      onOpenInspector={() => setInspectId(item.id)}
                      onMoveUp={() => moveItem(itemIndex, -1)}
                      onMoveDown={() => moveItem(itemIndex, 1)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </CatalogMediaWorkspace>

      {inspectedItem ? (
        <CatalogMediaInspector
          open
          onOpenChange={(open) => {
            if (!open) setInspectId(null);
          }}
          title={`${inspectedItem.mediaType === "video" ? "Video" : "Photo"} ${inspectedIndex + 1} details`}
          description={
            inspectedItem.mediaType === "video"
              ? "Add an optional caption. Video metadata is read-only here."
              : "Add a caption and alt text for accessibility and search."
          }
          preview={
            inspectedItem.mediaType === "video" ? (
              inspectedItem.previewUrl ? (
                <video
                  src={inspectedItem.previewUrl}
                  className="aspect-video w-full bg-surface-container object-cover"
                  controls
                  preload="metadata"
                >
                  <track kind="captions" srcLang="en" label="" />
                </video>
              ) : undefined
            ) : (
              <MediaImage
                src={inspectedItem.previewUrl}
                alt={inspectedItem.alt || `Photo ${inspectedIndex + 1}`}
                label={inspectedItem.caption || `Photo ${inspectedIndex + 1}`}
                imgClassName="size-full object-cover"
                sizes="320px"
              />
            )
          }
        >
          <div>
            <Label htmlFor="sale-media-caption">Caption</Label>
            <Input
              id="sale-media-caption"
              type="text"
              placeholder="Caption (optional)"
              maxLength={280}
              value={inspectedItem.caption}
              onChange={(event) =>
                setItems((prev) =>
                  prev.map((it) =>
                    it.id === inspectedItem.id ? { ...it, caption: event.target.value } : it,
                  ),
                )
              }
              disabled={!canManage || saving || inspectedItem.uploading}
              className="mt-1 min-h-10 text-sm"
            />
          </div>
          {inspectedItem.mediaType === "image" ? (
            <div>
              <Label htmlFor="sale-media-alt">Alt text</Label>
              <Input
                id="sale-media-alt"
                type="text"
                placeholder="Alt text (for SEO and accessibility)"
                maxLength={280}
                value={inspectedItem.alt}
                onChange={(event) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === inspectedItem.id ? { ...it, alt: event.target.value } : it,
                    ),
                  )
                }
                disabled={!canManage || saving || inspectedItem.uploading}
                className="mt-1 min-h-10 text-sm"
              />
            </div>
          ) : (
            <p className="font-body text-xs text-on-surface-variant">
              Status: {isPublished ? "Published" : "Draft until the sale ends"}
              {inspectedItem.uploadError ? ` · ${inspectedItem.uploadError}` : ""}
            </p>
          )}
        </CatalogMediaInspector>
      ) : null}
    </div>
  );
}
