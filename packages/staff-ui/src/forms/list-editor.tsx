"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type * as React from "react";
import { StaffButton } from "../primitives/button.js";

/**
 * An ordered list of small records edited in place (provenance lines, exhibitions): each row's
 * fields with Move up, Move down and Remove beside them, then Add. Says so when the list is
 * empty. The row's own fields are passed in, so any field layout fits.
 */
export function ListEditor<T>({
  items,
  getKey,
  renderItem,
  itemLabel,
  onAdd,
  onRemove,
  onMove,
  addLabel,
  emptyText,
  max,
  disabled = false,
  readOnly = false,
}: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Names a row for its buttons: "provenance line 2". */
  itemLabel: (index: number) => string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Leave out when the order is fixed (e.g. bands sorted by threshold): no move buttons. */
  onMove?: (from: number, to: number) => void;
  addLabel: string;
  emptyText: string;
  max?: number;
  disabled?: boolean;
  /** Shows the rows without the move, remove and add buttons, for people who may only look. */
  readOnly?: boolean;
}) {
  const full = max !== undefined && items.length >= max;
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-staff-sm text-staff-muted">{emptyText}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, index) => {
            const label = itemLabel(index);
            return (
              <li
                key={getKey(item, index)}
                className="flex flex-col gap-3 rounded-staff-lg border border-staff-line bg-staff-surface p-3 sm:flex-row sm:items-start"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-3">{renderItem(item, index)}</div>
                {readOnly ? null : (
                  <div className="flex shrink-0 gap-1 sm:pt-6">
                    {onMove ? (
                      <>
                        <StaffButton
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${label} up`}
                          disabled={disabled || index === 0}
                          icon={<ArrowUp aria-hidden />}
                          onClick={() => onMove(index, index - 1)}
                        />
                        <StaffButton
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${label} down`}
                          disabled={disabled || index === items.length - 1}
                          icon={<ArrowDown aria-hidden />}
                          onClick={() => onMove(index, index + 1)}
                        />
                      </>
                    ) : null}
                    <StaffButton
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${label}`}
                      disabled={disabled}
                      icon={<Trash2 aria-hidden />}
                      onClick={() => onRemove(index)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {full || readOnly ? null : (
        <div>
          <StaffButton
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            icon={<Plus aria-hidden />}
            onClick={onAdd}
          >
            {addLabel}
          </StaffButton>
        </div>
      )}
    </div>
  );
}
