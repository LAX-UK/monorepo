"use client";

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";
import type { SalePressMentionType, SalePressRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DatePicker } from "@auction/ui/components/date-picker";
import { EmptyState } from "@auction/ui/components/empty-state";
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
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLinkIcon, GripVerticalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PressItem = SalePressRef & { id: string };

const MENTION_TYPE_OPTIONS: { value: SalePressMentionType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "interview", label: "Interview" },
  { value: "quote", label: "Quote" },
  { value: "roundup", label: "Roundup" },
];

const NO_MENTION_TYPE = "__none__";

// ─── Empty add form ────────────────────────────────────────────────────────────

type PressForm = {
  url: string;
  headline: string;
  outletName: string;
  publishedAt: string;
  excerpt: string;
  mentionType: SalePressMentionType | "";
};

const EMPTY_FORM: PressForm = {
  url: "",
  headline: "",
  outletName: "",
  publishedAt: "",
  excerpt: "",
  mentionType: "",
};

// ─── Sortable row ──────────────────────────────────────────────────────────────

function PressItemRow({
  item,
  disabled,
  onRemoveConfirmed,
}: {
  item: PressItem;
  disabled: boolean;
  onRemoveConfirmed: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border border-border-hairline bg-surface-container-lowest p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 flex shrink-0 cursor-grab items-center text-on-surface-variant/50 hover:text-on-surface-variant focus:outline-none active:cursor-grabbing"
        aria-label="Drag to reorder"
        disabled={disabled}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-on-surface">{item.headline}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="font-label text-xs text-on-surface-variant">{item.outletName}</span>
          {item.publishedAt ? (
            <span className="font-body text-xs text-on-surface-variant/60">{item.publishedAt}</span>
          ) : null}
          {item.mentionType ? (
            <span className="rounded-full border border-outline-variant/30 px-1.5 py-0.5 font-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">
              {item.mentionType}
            </span>
          ) : null}
        </div>
        {item.excerpt ? (
          <p className="mt-1 line-clamp-2 font-body text-xs text-on-surface-variant/60">
            {item.excerpt}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-on-surface-variant/50 hover:text-link focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={"Open article in new tab"}
        >
          <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
        <ConfirmedRemoveButton
          ariaLabel="Remove press link"
          confirmTitle="Remove press link?"
          confirmBody={`Remove "${item.headline}" from public press coverage? This cannot be undone.`}
          disabled={Boolean(disabled)}
          loading={Boolean(disabled)}
          className="rounded p-1"
          onConfirmed={onRemoveConfirmed}
        />
      </div>
    </li>
  );
}

// ─── Main tab ──────────────────────────────────────────────────────────────────

type Props = {
  saleId: string;
  initialPressCoverage: SalePressRef[];
  canManage: boolean;
};

function toItem(ref: SalePressRef, index: number): PressItem {
  return { ...ref, id: `${index}::${ref.url}` };
}

function itemsToPressCoverage(items: PressItem[]): SalePressRef[] {
  return items.map(({ id: _id, ...r }) => r);
}

export function SalePressTab({ saleId, initialPressCoverage, canManage }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PressItem[]>(() => initialPressCoverage.map(toItem));
  const [form, setForm] = useState<PressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const savedRef = useRef(JSON.stringify(initialPressCoverage));
  const dirty = JSON.stringify(items.map(({ id: _id, ...r }) => r)) !== savedRef.current;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    setForm(EMPTY_FORM);
  };

  const persistPressCoverage = useCallback(
    async (nextItems: PressItem[]): Promise<boolean> => {
      setSaving(true);
      try {
        const pressCoverage = itemsToPressCoverage(nextItems);
        const result = await adminUpdateSaleResultAction(saleId, { pressCoverage });
        if (result.ok) {
          savedRef.current = JSON.stringify(pressCoverage);
          router.refresh();
          return true;
        }
        notify.error("Save failed", {
          description: !result.ok && result.error ? result.error : "Please try again.",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router, saleId],
  );

  const handleSave = useCallback(async () => {
    const ok = await persistPressCoverage(items);
    if (ok) {
      notify.success("Press coverage saved");
    }
  }, [items, persistPressCoverage]);

  const handleRemoveConfirmed = useCallback(
    async (itemId: string) => {
      if (saving || !canManage) return;
      const next = items.filter((it) => it.id !== itemId);
      const ok = await persistPressCoverage(next);
      if (!ok) return;
      setItems(next);
      notify.success("Press link removed");
    },
    [canManage, items, persistPressCoverage, saving],
  );

  return (
    <CatalogDetailTabPanel
      title="Press coverage"
      description="Curate external press and news links for this sale. Removing a link saves immediately; use Save coverage for new links and reordering."
      framed={false}
    >
      {/* Add form */}
      {canManage ? (
        <div className="mb-6 rounded-xl border border-border-hairline bg-surface-container-lowest p-5">
          <h3 className="mb-4 font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Add a press link
          </h3>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="press-url">Article URL *</Label>
                <Input
                  id="press-url"
                  type="url"
                  placeholder="https://dailymail.co.uk/article/..."
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  disabled={saving}
                  className="mt-1 font-body text-sm"
                />
              </div>
              <div>
                <Label htmlFor="press-outlet">Outlet name *</Label>
                <Input
                  id="press-outlet"
                  type="text"
                  placeholder="Daily Mail"
                  maxLength={200}
                  value={form.outletName}
                  onChange={(e) => setForm((f) => ({ ...f, outletName: e.target.value }))}
                  disabled={saving}
                  className="mt-1 font-body text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="press-headline">Headline *</Label>
              <Input
                id="press-headline"
                type="text"
                placeholder="Article headline as published"
                maxLength={500}
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                disabled={saving}
                className="mt-1 font-body text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="press-date">Publication date</Label>
                <DatePicker
                  id="press-date"
                  value={form.publishedAt}
                  onChange={(value) => setForm((f) => ({ ...f, publishedAt: value }))}
                  disabled={saving}
                  placeholder="Pick a date"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="press-type">Mention type</Label>
                <Select
                  value={form.mentionType || NO_MENTION_TYPE}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      mentionType: value === NO_MENTION_TYPE ? "" : (value as SalePressMentionType),
                    }))
                  }
                  disabled={saving}
                >
                  <SelectTrigger id="press-type" className="mt-1 w-full font-body text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MENTION_TYPE}>— select type —</SelectItem>
                    {MENTION_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="press-excerpt">
                Excerpt / pull quote
                <span className="ml-1 font-body font-normal normal-case text-on-surface-variant/50">
                  ({(form.excerpt ?? "").length}/280)
                </span>
              </Label>
              <Textarea
                id="press-excerpt"
                placeholder="Short quote or summary from the article (max 280 chars)"
                maxLength={280}
                rows={2}
                value={form.excerpt ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                disabled={saving}
                className="mt-1 font-body text-sm"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLink}
                disabled={
                  saving || !form.url.trim() || !form.headline.trim() || !form.outletName.trim()
                }
              >
                Add link
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* List */}
      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-5">
        {items.length === 0 ? (
          <EmptyState
            title="No press links yet"
            description="Add links to articles, features, and interviews covering this sale."
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
              <ol className="list-none space-y-2 p-0" aria-live="polite">
                {items.map((item) => (
                  <PressItemRow
                    key={item.id}
                    item={item}
                    disabled={!canManage || saving}
                    onRemoveConfirmed={() => handleRemoveConfirmed(item.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {canManage ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-hairline pt-4">
            <p className="font-body text-xs text-on-surface-variant">
              {items.length} link{items.length !== 1 ? "s" : ""}
              {dirty && !saving ? " · Unsaved changes" : ""}
              {saving ? " · Saving…" : ""}
            </p>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              variant="cta"
              size="sm"
            >
              {saving ? "Saving…" : "Save coverage"}
            </Button>
          </div>
        ) : null}
      </div>
    </CatalogDetailTabPanel>
  );
}
