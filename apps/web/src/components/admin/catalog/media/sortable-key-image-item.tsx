"use client";

import { MediaImage } from "@/components/ui/media-image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CatalogMediaCard } from "./catalog-media-card";
import { CatalogMediaManageActions } from "./catalog-media-card-actions";

type Props = {
  sortId: string;
  src: string;
  index: number;
  primaryLabel: string;
  imageLabel: string;
  onMakePrimary: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpen?: () => void;
  isLast?: boolean;
  disabled?: boolean;
  showManage?: boolean;
  isSelected?: boolean;
};

export function SortableKeyImageItem({
  sortId,
  src,
  index,
  primaryLabel,
  imageLabel,
  onMakePrimary,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpen,
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
      {...(onOpen && !disabled ? { onOpen } : {})}
      media={
        <MediaImage
          src={src}
          alt={primary ? `Primary ${imageLabel.toLowerCase()}` : `${imageLabel} ${index + 1}`}
          label={primary ? `Primary ${imageLabel.toLowerCase()}` : imageLabel}
          imgClassName="size-full object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
        />
      }
      title={`${imageLabel} ${index + 1}`}
      subtitle={primary ? primaryLabel : `Position ${index + 1}`}
      orderLabel={`Image ${index + 1}`}
      {...(primary ? { primaryLabel } : {})}
      actions={
        showManage ? (
          <CatalogMediaManageActions
            index={index}
            isLast={isLast}
            disabled={disabled}
            dragAttributes={attributes}
            dragListeners={listeners}
            dragAriaLabel={`Drag ${imageLabel.toLowerCase()} ${index + 1} to reorder`}
            moveEarlierAriaLabel={`Move ${imageLabel.toLowerCase()} ${index + 1} earlier`}
            moveLaterAriaLabel={`Move ${imageLabel.toLowerCase()} ${index + 1} later`}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            {...(onOpen
              ? {
                  onEditDetails: onOpen,
                  editDetailsAriaLabel: `View ${imageLabel.toLowerCase()} ${index + 1}`,
                }
              : {})}
            showMakePrimary={!primary}
            onMakePrimary={onMakePrimary}
            makePrimaryLabel="Make primary"
            removeAriaLabel={`Remove ${imageLabel.toLowerCase()} ${index + 1}`}
            removeConfirmTitle={`Remove this ${imageLabel.toLowerCase()}?`}
            removeConfirmBody="The image will be removed from this collection."
            onRemoveConfirmed={onRemove}
          />
        ) : undefined
      }
    />
  );
}
