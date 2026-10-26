"use client";

import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { Button } from "@auction/ui/components/button";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Star } from "lucide-react";
import type { ReactNode } from "react";

type ReorderProps = {
  index: number;
  isLast: boolean;
  disabled?: boolean | undefined;
  dragAttributes?: DraggableAttributes | undefined;
  dragListeners?: SyntheticListenerMap | undefined;
  dragAriaLabel: string;
  moveEarlierAriaLabel: string;
  moveLaterAriaLabel: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

type ManageProps = ReorderProps & {
  onEditDetails?: () => void;
  editDetailsAriaLabel?: string;
  onMakePrimary?: () => void;
  makePrimaryLabel?: string;
  showMakePrimary?: boolean;
  removeAriaLabel: string;
  removeConfirmTitle: string;
  removeConfirmBody: ReactNode;
  onRemoveConfirmed: () => void | Promise<void>;
  removeLoading?: boolean;
};

/** Compact reorder + edit + remove controls shown in Manage mode. */
export function CatalogMediaManageActions({
  index,
  isLast,
  disabled = false,
  dragAttributes,
  dragListeners,
  dragAriaLabel,
  moveEarlierAriaLabel,
  moveLaterAriaLabel,
  onMoveUp,
  onMoveDown,
  onEditDetails,
  editDetailsAriaLabel = "Edit details",
  onMakePrimary,
  makePrimaryLabel = "Make hero",
  showMakePrimary = false,
  removeAriaLabel,
  removeConfirmTitle,
  removeConfirmBody,
  onRemoveConfirmed,
  removeLoading = false,
}: ManageProps) {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-9 shrink-0"
        aria-label={dragAriaLabel}
        disabled={disabled}
        {...(dragAttributes ?? {})}
        {...(dragListeners ?? {})}
      >
        <GripVertical className="size-4" aria-hidden />
      </Button>
      {onEditDetails ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEditDetails}
          disabled={disabled}
          aria-label={editDetailsAriaLabel}
        >
          <Pencil className="mr-1.5 size-4" aria-hidden />
          Edit
        </Button>
      ) : null}
      {showMakePrimary && onMakePrimary ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onMakePrimary}
          disabled={disabled}
        >
          <Star className="mr-1.5 size-4" aria-hidden />
          {makePrimaryLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onMoveUp}
        disabled={disabled || index === 0}
        aria-label={moveEarlierAriaLabel}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onMoveDown}
        disabled={disabled || isLast}
        aria-label={moveLaterAriaLabel}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <ConfirmedRemoveButton
        ariaLabel={removeAriaLabel}
        confirmTitle={removeConfirmTitle}
        confirmBody={removeConfirmBody}
        disabled={disabled}
        loading={removeLoading}
        onConfirmed={onRemoveConfirmed}
      />
    </>
  );
}
