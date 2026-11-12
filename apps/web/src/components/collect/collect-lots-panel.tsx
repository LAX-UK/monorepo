"use client";

import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { COLLECT_FIELD_IDS } from "@/lib/collect/collect-form";
import type { CollectionLotLine } from "@auction/types";
import { Checkbox } from "@auction/ui/lax/checkbox";
import { FieldError } from "@auction/ui/lax/field";

/** The lots in this visit: those that can be booked are ticked, the rest say why they cannot. */
export function CollectLotsPanel({
  lots,
  selected,
  disabled,
  error,
  onToggle,
}: {
  lots: readonly CollectionLotLine[];
  selected: readonly string[];
  disabled: boolean;
  error: string | undefined;
  onToggle: (lotId: string) => void;
}) {
  return (
    <WorkspacePanel title={COLLECT_COPY.panels.lots}>
      <fieldset id={COLLECT_FIELD_IDS.lots} tabIndex={-1} className="min-w-0 outline-none">
        <legend className="sr-only">{COLLECT_COPY.panels.lots}</legend>
        <ul className="flex flex-col divide-y divide-lax-line-subtle">
          {lots.map((lot) => {
            const id = `collect-lot-${lot.lotId}`;
            return (
              <li key={lot.lotId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Checkbox
                  id={id}
                  checked={selected.includes(lot.lotId)}
                  disabled={!lot.collectable || disabled}
                  onCheckedChange={() => onToggle(lot.lotId)}
                  aria-describedby={lot.collectable ? undefined : `${id}-why`}
                  className="mt-0.5"
                />
                <label htmlFor={id} className="min-w-0 flex-1 text-lax-14 text-lax-fg">
                  {lot.lotNumber !== null ? `Lot ${lot.lotNumber} · ` : ""}
                  {lot.title}
                  {lot.collectable ? null : (
                    <span id={`${id}-why`} className="block text-lax-13 text-lax-muted">
                      {lot.blockedMessage ?? COLLECT_COPY.lots.notPaid}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        {error ? (
          <div className="mt-3">
            <FieldError>{error}</FieldError>
          </div>
        ) : null}
      </fieldset>
    </WorkspacePanel>
  );
}
