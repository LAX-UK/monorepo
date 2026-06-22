"use client";

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";
import type { SalePressMentionType, SalePressRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLinkIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PressItem = SalePressRef & { id: string };

const MENTION_TYPE_OPTIONS: { value: SalePressMentionType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "interview", label: "Interview" },
  { value: "quote", label: "Quote" },
  { value: "roundup", label: "Roundup" },
];

const inputCls =
  "block w-full rounded-md border border-outline-variant/40 bg-surface px-3 py-2 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

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
  onRemove,
}: {
  item: PressItem;
  disabled: boolean;
  onRemove: () => void;
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
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded p-1 text-on-surface-variant/50 hover:text-error focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
          aria-label="Remove press link"
        >
          <Trash2Icon className="size-4" aria-hidden />
        </button>
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

export function SalePressTab({ saleId, initialPressCoverage, canManage }: Props) {
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

  const handleSave = useCallback(async () => {
    setSaving(true);
    const pressCoverage: SalePressRef[] = items.map(({ id: _id, ...r }) => r);
    const result = await adminUpdateSaleResultAction(saleId, { pressCoverage });
    setSaving(false);
    if (result.ok) {
      savedRef.current = JSON.stringify(pressCoverage);
      notify.success("Press coverage saved");
    } else {
      notify.error("Save failed", {
        description: !result.ok && result.error ? result.error : "Please try again.",
      });
    }
  }, [saleId, items]);

  return (
    <CatalogDetailTabPanel
      title="Press coverage"
      description="Curate external press and news links for this sale. Links appear publicly on the sale page as soon as they are saved."
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
                <label
                  className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                  htmlFor="press-url"
                >
                  Article URL *
                </label>
                <input
                  id="press-url"
                  type="url"
                  placeholder="https://dailymail.co.uk/article/..."
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  disabled={saving}
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                  htmlFor="press-outlet"
                >
                  Outlet name *
                </label>
                <input
                  id="press-outlet"
                  type="text"
                  placeholder="Daily Mail"
                  maxLength={200}
                  value={form.outletName}
                  onChange={(e) => setForm((f) => ({ ...f, outletName: e.target.value }))}
                  disabled={saving}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label
                className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                htmlFor="press-headline"
              >
                Headline *
              </label>
              <input
                id="press-headline"
                type="text"
                placeholder="Article headline as published"
                maxLength={500}
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                disabled={saving}
                className={inputCls}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                  htmlFor="press-date"
                >
                  Publication date
                </label>
                <input
                  id="press-date"
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                  disabled={saving}
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                  htmlFor="press-type"
                >
                  Mention type
                </label>
                <select
                  id="press-type"
                  value={form.mentionType ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mentionType: (e.target.value || "") as SalePressMentionType | "",
                    }))
                  }
                  disabled={saving}
                  className={inputCls}
                >
                  <option value="">— select type —</option>
                  {MENTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label
                className="mb-1 block font-label text-xs uppercase tracking-wider text-on-surface-variant"
                htmlFor="press-excerpt"
              >
                Excerpt / pull quote
                <span className="ml-1 font-body normal-case text-on-surface-variant/50">
                  ({(form.excerpt ?? "").length}/280)
                </span>
              </label>
              <textarea
                id="press-excerpt"
                placeholder="Short quote or summary from the article (max 280 chars)"
                maxLength={280}
                rows={2}
                value={form.excerpt ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                disabled={saving}
                className={inputCls}
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
                    onRemove={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
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
