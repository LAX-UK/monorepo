"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { DetailBoardKpiStrip, DetailBoardToolbar } from "@/components/admin/catalog/detail-board";
import {
  CatalogMediaAddPanel,
  CatalogMediaCollectionActions,
  CatalogMediaInspector,
  CatalogMediaWorkspace,
  MediaReorderLiveRegion,
  useMediaReorderAnnouncement,
} from "@/components/admin/catalog/media";
import { PressItemCard } from "@/components/admin/sale-detail/tabs/press-item-card";
import {
  EMPTY_PRESS_FORM,
  MENTION_TYPE_OPTIONS,
  type PressFormState,
  PressMentionForm,
} from "@/components/admin/sale-detail/tabs/press-mention-form";
import {
  type PressItem,
  pressItemsToCoverage,
  toPressItem,
  usePressMutations,
} from "@/components/admin/sale-detail/tabs/use-press-mutations";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import { buildSalePressCardImage } from "@/lib/data/view-models/sale-press-tab.presenters";
import {
  buildSalePressKpiTiles,
  matchesSalePressSearch,
} from "@/lib/data/view-models/sale-press-tab.vm";
import { notify } from "@/lib/ui/notify";
import type { SalePressMentionType, SalePressRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DatePicker } from "@auction/ui/components/date-picker";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Textarea } from "@auction/ui/components/textarea";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";

function PressItemInspectorFields({
  item,
  index,
  disabled,
  onChange,
  onMentionTypeChange,
}: {
  item: PressItem;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<PressItem>) => void;
  onMentionTypeChange: (value: SalePressMentionType | null) => void;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`press-headline-${item.id}`}>Headline</Label>
        <Input
          id={`press-headline-${item.id}`}
          value={item.headline}
          onChange={(event) => onChange({ headline: event.target.value })}
          aria-label={`Headline for press item ${index + 1}`}
          placeholder="Headline"
          maxLength={500}
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`press-outlet-${item.id}`}>Outlet</Label>
        <Input
          id={`press-outlet-${item.id}`}
          value={item.outletName}
          onChange={(event) => onChange({ outletName: event.target.value })}
          aria-label={`Outlet for press item ${index + 1}`}
          placeholder="Outlet"
          maxLength={200}
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`press-date-${item.id}`}>Publication date</Label>
        <DatePicker
          id={`press-date-${item.id}`}
          value={item.publishedAt ?? ""}
          onChange={(value) => onChange({ publishedAt: value })}
          placeholder="Publication date"
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`press-url-${item.id}`}>Article URL</Label>
        <Input
          id={`press-url-${item.id}`}
          type="url"
          value={item.url}
          onChange={(event) => onChange({ url: event.target.value })}
          aria-label={`Article URL for press item ${index + 1}`}
          placeholder="Article URL"
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`press-type-${item.id}`}>Mention type</Label>
        <Select
          value={item.mentionType ?? "__none__"}
          onValueChange={(value) =>
            onMentionTypeChange(value === "__none__" ? null : (value as SalePressMentionType))
          }
          disabled={disabled}
        >
          <SelectTrigger
            id={`press-type-${item.id}`}
            aria-label={`Mention type for press item ${index + 1}`}
            className="mt-1"
          >
            <SelectValue placeholder="Mention type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No mention type</SelectItem>
            {MENTION_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`press-excerpt-${item.id}`}>Excerpt</Label>
        <Textarea
          id={`press-excerpt-${item.id}`}
          value={item.excerpt ?? ""}
          onChange={(event) => onChange({ excerpt: event.target.value })}
          aria-label={`Excerpt for press item ${index + 1}`}
          placeholder="Excerpt or pull quote"
          maxLength={280}
          rows={3}
          disabled={disabled}
          className="mt-1"
        />
      </div>
    </>
  );
}

type Props = {
  saleId: string;
  initialPressCoverage: SalePressRef[];
  canManage: boolean;
};

function toItem(ref: SalePressRef, index: number): PressItem {
  return toPressItem(ref, index);
}

function itemsToPressCoverage(items: PressItem[]): SalePressRef[] {
  return pressItemsToCoverage(items);
}

export function SalePressTab({ saleId, initialPressCoverage, canManage }: Props) {
  const { saving, persistPressCoverage } = usePressMutations(saleId);
  const [items, setItems] = useState<PressItem[]>(() => initialPressCoverage.map(toItem));
  const [form, setForm] = useState<PressFormState>(EMPTY_PRESS_FORM);
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

  const savedRef = useRef(JSON.stringify(initialPressCoverage));
  const dirty = JSON.stringify(items.map(({ id: _id, ...r }) => r)) !== savedRef.current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleItems = useMemo(
    () => items.filter((item) => matchesSalePressSearch(item, search)),
    [items, search],
  );
  const reorderFiltered = search.trim().length > 0;

  useEffect(() => {
    if (reorderFiltered) setShowManage(false);
  }, [reorderFiltered, setShowManage]);

  const moveItem = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    announceMove(`press item ${index + 1}`, index, target);
    setItems((prev) => arrayMove(prev, index, target));
  };

  const updateItem = (itemId: string, patch: Partial<PressItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const updateMentionType = (itemId: string, mentionType: SalePressMentionType | null) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (mentionType) return { ...item, mentionType };
        const { mentionType: _mentionType, ...withoutMentionType } = item;
        return withoutMentionType;
      }),
    );
  };

  const addLink = () => {
    const url = form.url.trim();
    const headline = form.headline.trim();
    const outletName = form.outletName.trim();
    if (!url || !headline || !outletName) {
      notify.error("URL, headline, and outlet name are required.");
      return;
    }
    try {
      new URL(url);
    } catch {
      notify.error("Please enter a valid URL.");
      return;
    }
    const ref: SalePressRef = { url, headline, outletName };
    if (form.publishedAt?.trim()) ref.publishedAt = form.publishedAt.trim();
    if (form.excerpt?.trim()) ref.excerpt = form.excerpt.trim();
    if (form.mentionType) ref.mentionType = form.mentionType as SalePressMentionType;
    setItems((prev) => [...prev, toItem(ref, prev.length)]);
    setForm(EMPTY_PRESS_FORM);
  };

  const handleSave = async () => {
    const ok = await persistPressCoverage(items);
    if (ok) {
      savedRef.current = JSON.stringify(itemsToPressCoverage(items));
      notify.success("Press coverage saved");
    }
  };

  const handleRemoveConfirmed = async (itemId: string) => {
    if (saving || !canManage) return;
    const next = items.filter((it) => it.id !== itemId);
    const ok = await persistPressCoverage(next);
    if (!ok) return;
    setItems(next);
    savedRef.current = JSON.stringify(itemsToPressCoverage(next));
    if (inspectId === itemId) setInspectId(null);
    notify.success("Press link removed");
  };

  const inspectedItem = inspectId ? items.find((item) => item.id === inspectId) : null;
  const inspectedIndex = inspectedItem ? items.findIndex((item) => item.id === inspectId) : -1;

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Press summary" tiles={buildSalePressKpiTiles(items)} />

      <CatalogMediaWorkspace
        title="Press coverage"
        description="External press and news links for this sale."
        count={visibleItems.length}
        actions={
          canManage ? (
            <CatalogMediaCollectionActions
              addButtonRef={addButtonRef}
              manageButtonRef={manageButtonRef}
              showAdd={showAdd}
              showManage={showManage}
              onToggleAdd={toggleAdd}
              onToggleManage={toggleManage}
              addLabel="Add press link"
              manageLabel="Manage"
              manageDisabled={reorderFiltered}
            />
          ) : undefined
        }
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search press…"
            trailing={
              reorderFiltered ? (
                <span className="font-body text-xs text-on-surface-variant">
                  Clear search to reorder.
                </span>
              ) : null
            }
          />
        }
        addPanel={
          canManage && showAdd ? (
            <CatalogMediaAddPanel
              panelRef={addPanelRef}
              title="Add a press link"
              description="Add the published article details. Preview imagery is enriched from the article."
              onCancel={closeAddPanel}
            >
              <PressMentionForm form={form} onChange={setForm} onAdd={addLink} saving={saving} />
            </CatalogMediaAddPanel>
          ) : undefined
        }
        liveRegion={<MediaReorderLiveRegion message={message} />}
        saveBar={
          dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-on-surface-variant">
                You have unsaved press coverage changes.
              </p>
              <Button onClick={() => void handleSave()} disabled={saving} variant="cta" size="sm">
                {saving ? "Saving…" : "Save coverage"}
              </Button>
            </div>
          ) : undefined
        }
        footer={
          <span aria-live="polite">
            {`Showing ${visibleItems.length} of ${items.length}`}
            {dirty && !saving ? " · Unsaved changes" : ""}
            {saving ? " · Saving…" : ""}
          </span>
        }
      >
        {items.length === 0 && !showAdd ? (
          canManage ? (
            <AdminEmptyState
              title="No press links yet"
              description="Curated press coverage for this sale will appear here."
              action={
                <Button type="button" size="sm" onClick={toggleAdd}>
                  Add press link
                </Button>
              }
            />
          ) : (
            <AdminEmptyState
              title="No press links yet"
              description="Curated press coverage for this sale will appear here."
            />
          )
        ) : visibleItems.length === 0 ? (
          <AdminEmptyState
            title="No matching press links"
            description="Try a different search term."
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
                  if (from >= 0 && to >= 0) announceMove(`press item ${from + 1}`, from, to);
                  return arrayMove(prev, from, to);
                });
              }
            }}
          >
            <SortableContext
              items={visibleItems.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => {
                  const itemIndex = items.findIndex((it) => it.id === item.id);
                  return (
                    <PressItemCard
                      key={item.id}
                      item={item}
                      index={itemIndex}
                      isLast={itemIndex === items.length - 1}
                      showManage={showManage}
                      isSelected={inspectId === item.id}
                      disabled={!canManage || saving}
                      onOpenInspector={() => setInspectId(item.id)}
                      onMoveUp={() => moveItem(itemIndex, -1)}
                      onMoveDown={() => moveItem(itemIndex, 1)}
                      onRemoveConfirmed={() => handleRemoveConfirmed(item.id)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </CatalogMediaWorkspace>

      {inspectedItem && inspectedIndex >= 0 ? (
        <CatalogMediaInspector
          open
          onOpenChange={(open) => {
            if (!open) setInspectId(null);
          }}
          title={`Press ${inspectedIndex + 1} details`}
          description="Update article metadata. Open Graph imagery is read-only and enriched from the article."
          preview={buildSalePressCardImage(inspectedItem)}
        >
          <PressItemInspectorFields
            item={inspectedItem}
            index={inspectedIndex}
            disabled={!canManage || saving}
            onChange={(patch) => updateItem(inspectedItem.id, patch)}
            onMentionTypeChange={(value) => updateMentionType(inspectedItem.id, value)}
          />
        </CatalogMediaInspector>
      ) : null}
    </div>
  );
}
