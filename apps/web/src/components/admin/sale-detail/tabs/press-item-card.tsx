"use client";

import { CatalogMediaCard, CatalogMediaManageActions } from "@/components/admin/catalog/media";
import type { PressItem } from "@/components/admin/sale-detail/tabs/use-press-mutations";
import { buildSalePressCardImage } from "@/lib/data/view-models/sale-press-tab.presenters";
import {
  formatSalePressDate,
  pressMentionTypeLabel,
} from "@/lib/data/view-models/sale-press-tab.vm";
import { Button } from "@auction/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLinkIcon } from "lucide-react";

type Props = {
  item: PressItem;
  index: number;
  isLast: boolean;
  showManage: boolean;
  isSelected?: boolean;
  disabled: boolean;
  onOpenInspector: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveConfirmed: () => Promise<void>;
};

export function PressItemCard({
  item,
  index,
  isLast,
  showManage,
  isSelected,
  disabled,
  onOpenInspector,
  onMoveUp,
  onMoveDown,
  onRemoveConfirmed,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || !showManage,
  });

  return (
    <CatalogMediaCard
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={isDragging ? "border-primary ring-2 ring-primary/20" : undefined}
      {...(isSelected ? { isSelected: true } : {})}
      {...(disabled ? {} : { onOpen: onOpenInspector })}
      media={buildSalePressCardImage(item)}
      title={item.headline}
      subtitle={
        <>
          {item.outletName}
          {item.publishedAt
            ? ` · ${formatSalePressDate(item.publishedAt) ?? item.publishedAt}`
            : ""}
        </>
      }
      orderLabel={`Press ${index + 1}`}
      badge={
        <span className="rounded-full bg-info-container/95 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-wide text-info shadow-sm">
          {pressMentionTypeLabel(item.mentionType)}
        </span>
      }
      actions={
        <>
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="mr-1.5 size-4" aria-hidden />
              Open article
            </a>
          </Button>
          {showManage ? (
            <CatalogMediaManageActions
              index={index}
              isLast={isLast}
              disabled={disabled}
              dragAttributes={attributes}
              dragListeners={listeners}
              dragAriaLabel={`Drag press item ${index + 1} to reorder`}
              moveEarlierAriaLabel={`Move press item ${index + 1} earlier`}
              moveLaterAriaLabel={`Move press item ${index + 1} later`}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onEditDetails={onOpenInspector}
              editDetailsAriaLabel={`Edit details for press item ${index + 1}`}
              removeAriaLabel="Remove press link"
              removeConfirmTitle="Remove press link?"
              removeConfirmBody={`Remove "${item.headline}" from public press coverage? This cannot be undone.`}
              onRemoveConfirmed={onRemoveConfirmed}
              removeLoading={disabled}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenInspector}
              disabled={disabled}
            >
              Edit details
            </Button>
          )}
        </>
      }
    >
      {item.excerpt ? (
        <p className="line-clamp-3 font-body text-sm text-on-surface-variant">{item.excerpt}</p>
      ) : null}
    </CatalogMediaCard>
  );
}
