"use client";

import { CatalogMediaCard, CatalogMediaManageActions } from "@/components/admin/catalog/media";
import { MediaImage } from "@/components/ui/media-image";
import type { ReorderableImageEntry } from "@/lib/forms/image/use-image-reorder";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  item: ReorderableImageEntry;
  sortId: string;
  index: number;
  onMakePrimary: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenInspector?: () => void;
  isLast?: boolean;
  disabled?: boolean;
  showManage?: boolean;
  isSelected?: boolean;
};

export function SortableImageItem({
  item,
  sortId,
  index,
  onMakePrimary,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenInspector,
  isLast = false,
  disabled = false,
  showManage = false,
  isSelected = false,
}: Props) {
  const primary = index === 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
    disabled: disabled || !showManage,
  });

  const altPreview = item.alt.trim();

  return (
    <CatalogMediaCard
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
      className={isDragging ? "border-primary ring-2 ring-primary/20" : undefined}
      isHero={primary}
      {...(isSelected ? { isSelected: true } : {})}
      {...(onOpenInspector && !disabled ? { onOpen: onOpenInspector } : {})}
      media={
        <MediaImage
          src={item.key}
          alt={altPreview || (primary ? "Primary lot image" : `Lot image ${index + 1}`)}
          label={primary ? "Primary lot artwork" : "Lot artwork"}
          imgClassName="size-full object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
        />
      }
      title={altPreview || `Lot image ${index + 1}`}
      subtitle={
        altPreview
          ? primary
            ? "Catalogue hero"
            : `Position ${index + 1}`
          : primary
            ? "Displayed as the catalogue hero"
            : `Position ${index + 1}`
      }
      orderLabel={`Image ${index + 1}`}
      {...(primary ? { primaryLabel: "Catalogue hero" } : {})}
      actions={
        showManage ? (
          <CatalogMediaManageActions
            index={index}
            isLast={isLast}
            disabled={disabled}
            dragAttributes={attributes}
            dragListeners={listeners}
            dragAriaLabel={`Drag lot image ${index + 1} to reorder`}
            moveEarlierAriaLabel={`Move lot image ${index + 1} earlier`}
            moveLaterAriaLabel={`Move lot image ${index + 1} later`}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            {...(onOpenInspector
              ? {
                  onEditDetails: onOpenInspector,
                  editDetailsAriaLabel: `Edit details for lot image ${index + 1}`,
                }
              : {})}
            showMakePrimary={!primary}
            onMakePrimary={onMakePrimary}
            makePrimaryLabel="Make hero"
            removeAriaLabel={`Remove lot image ${index + 1}`}
            removeConfirmTitle="Remove this lot image?"
            removeConfirmBody="The image will be removed when you save your changes."
            onRemoveConfirmed={onRemove}
          />
        ) : undefined
      }
    />
  );
}
