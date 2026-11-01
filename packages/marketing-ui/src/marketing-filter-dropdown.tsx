"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  type MarketingFilterOption,
  MarketingFilterOptionList,
  type MarketingFilterSelection,
} from "./marketing-filter-option-list.js";

export type MarketingFilterDropdownProps = {
  /** Trigger text and popover heading (e.g. "Medium"). */
  label: string;
  /**
   * Trigger text in place of the label and its count, for a choice that always has a value,
   * such as a sort ("Sort: Newest"). The popover heading keeps `label`.
   */
  triggerLabel?: string;
  options: readonly MarketingFilterOption[];
  /** Applied values; the popover edits a draft copy of them. */
  selected: readonly string[];
  onApply: (next: string[]) => void;
  selection?: MarketingFilterSelection;
  idPrefix: string;
  applyLabel?: string;
  cancelLabel?: string;
  className?: string;
};

/**
 * Toolbar facet popover (Figma 543:6997). Choices stay a draft until Apply, so one navigation
 * covers several ticks; Cancel, Escape and outside clicks discard the draft.
 */
export function MarketingFilterDropdown({
  label,
  triggerLabel,
  options,
  selected,
  onApply,
  selection = "multiple",
  idPrefix,
  applyLabel = "Apply",
  cancelLabel = "Cancel",
  className,
}: MarketingFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([...selected]);
  const count = selected.length;

  function handleOpenChange(next: boolean) {
    if (next) setDraft([...selected]);
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={triggerLabel ?? (count > 0 ? `${label}, ${count} selected` : label)}
          className={cn(
            "min-h-11 gap-1.5 rounded-none px-3 font-body text-sm font-normal text-on-surface hover:bg-surface-container-low",
            FOCUS_RING,
            className,
          )}
        >
          <span aria-hidden>
            {triggerLabel ?? (
              <>
                {label}
                {count > 0 ? ` (${count})` : null}
              </>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 motion-safe:transition-transform", open && "rotate-180")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(23.75rem,calc(100vw-2rem))] rounded-none border-border-hairline bg-surface-container-lowest p-6 sm:p-10"
      >
        <p className="mb-4 font-label text-base text-on-surface">{label}</p>
        <MarketingFilterOptionList
          legend={label}
          options={options}
          selected={draft}
          onChange={setDraft}
          selection={selection}
          idPrefix={idPrefix}
          className="max-h-[min(50dvh,20rem)] overflow-y-auto"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-4 font-label text-sm font-semibold"
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="cta"
            className="min-h-11 px-5"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            {applyLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
