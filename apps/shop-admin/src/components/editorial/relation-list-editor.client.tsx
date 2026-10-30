"use client";

import type { RelationRow } from "@/server/domain/editorial-links.vm";
import { type EntityOption, EntityPicker, StaffButton, StatusBadge } from "@auction/staff-ui";
import { ArrowDown, ArrowUp, X } from "@auction/staff-ui/icons";
import { useCallback, useRef } from "react";

/**
 * A list of related records chosen by name: what is linked now, each with controls to reorder
 * (where order matters) and remove, and a searchable picker to add another. Records already in
 * the list are shown in the picker as added, never offered twice. Edits are reported through
 * `onChange`; saving belongs to the editor that holds the list.
 */
export function RelationListEditor<T extends RelationRow>({
  label,
  plural,
  items,
  onChange,
  search,
  ordered,
  disabled = false,
  readOnly = false,
  emptyText,
  addLabel,
  max,
}: {
  /** Names the list for assistive technology: "Artworks in this exhibition". */
  label: string;
  /** What the records are called, plural and lower case: "artworks". */
  plural: string;
  items: readonly T[];
  onChange: (next: T[]) => void;
  /** The records matching what was typed; empty text lists the most recent. */
  search: (query: string) => Promise<readonly T[]>;
  /** False hides the reorder controls, for sets whose order is not stored. */
  ordered: boolean;
  disabled?: boolean;
  /** Shows the list without moving, removing or adding controls. */
  readOnly?: boolean;
  emptyText: string;
  addLabel: string;
  /** The most records the list can hold; adding is switched off once it is full. */
  max?: number;
}) {
  const latest = useRef(items);
  latest.current = items;
  const found = useRef(new Map<string, T>());

  const searchOptions = useCallback(
    async (query: string): Promise<EntityOption[]> => {
      const rows = await search(query);
      const chosen = new Set(latest.current.map((item) => item.id));
      return rows.map((row) => {
        found.current.set(row.id, row);
        const added = chosen.has(row.id);
        return {
          id: row.id,
          label: row.title,
          ...(row.subtitle ? { description: row.subtitle } : {}),
          ...(added ? { meta: "Added" } : row.notPublic ? { meta: "Not public" } : {}),
          disabled: added,
        };
      });
    },
    [search],
  );

  const full = max !== undefined && items.length >= max;

  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded-staff-lg border border-dashed border-staff-line px-4 py-6 text-center text-staff-sm text-staff-muted">
          {emptyText}
        </p>
      ) : (
        <ul
          aria-label={label}
          className="divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line bg-staff-surface"
        >
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              {ordered ? (
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-center text-staff-xs text-staff-muted tabular-nums"
                >
                  {index + 1}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-staff-sm font-medium text-staff-fg">
                  {item.title}
                </span>
                {item.subtitle ? (
                  <span className="truncate text-staff-xs text-staff-muted">{item.subtitle}</span>
                ) : null}
              </span>
              {item.notPublic ? <StatusBadge tone="neutral">Not public</StatusBadge> : null}
              {readOnly ? null : (
                <span className="flex shrink-0 items-center gap-0.5">
                  {ordered ? (
                    <>
                      <StaffButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${item.title} up`}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </StaffButton>
                      <StaffButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${item.title} down`}
                        disabled={disabled || index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </StaffButton>
                    </>
                  ) : null}
                  <StaffButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.title}`}
                    disabled={disabled}
                    onClick={() => onChange(items.filter((other) => other.id !== item.id))}
                  >
                    <X aria-hidden />
                  </StaffButton>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly ? null : (
        <EntityPicker
          value={null}
          onValueChange={(option) => {
            const row = option ? found.current.get(option.id) : undefined;
            if (row && !items.some((item) => item.id === row.id)) onChange([...items, row]);
          }}
          search={searchOptions}
          placeholder={addLabel}
          searchPlaceholder={`Search ${plural} by name`}
          emptyText={`No ${plural} match.`}
          disabled={disabled || full}
          aria-label={addLabel}
          className="max-w-sm"
        />
      )}
      {full ? (
        <p className="text-staff-xs text-staff-muted">
          The list is full at {max} {plural}. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
}
