"use client";

import { HydrationDeferred } from "@/components/layout/hydration-deferred";
import { useSplitOverlayOpen } from "@/hooks/use-split-overlay-open";
import type { CategoryNode } from "@auction/types";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

type FlatCategory = CategoryNode & {
  depth: number;
  path: string;
};

const fieldAppearanceTriggerClassName =
  "flex h-10 w-full items-center justify-start rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 text-left font-body text-sm normal-case tracking-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type Props = {
  categories: CategoryNode[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  /** Optional classes merged onto the trigger button (e.g. drawer field parity). */
  triggerClassName?: string;
  /** When true, omits extra vertical spacing and selected chips below the trigger. */
  compact?: boolean;
  /** `field` matches boxed drawer controls; `button` keeps legacy caps outline trigger. */
  appearance?: "button" | "field";
};

function flattenCategories(categories: CategoryNode[], parentPath = "", depth = 0): FlatCategory[] {
  return categories.flatMap((category) => {
    const path = parentPath ? `${parentPath} / ${category.name}` : category.name;
    return [{ ...category, path, depth }, ...flattenCategories(category.children, path, depth + 1)];
  });
}

function CategoryCommandList({
  flat,
  value,
  onToggle,
}: {
  flat: FlatCategory[];
  value: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search categories..." />
      <CommandList className="max-h-[min(50dvh,20rem)]">
        <CommandEmpty>No categories found.</CommandEmpty>
        <CommandGroup>
          {flat.map((category) => {
            const checked = value.includes(category.id);
            return (
              <CommandItem
                key={category.id}
                value={`${category.path} ${category.slug}`}
                onSelect={() => onToggle(category.id)}
                className="justify-between"
              >
                <span style={{ paddingLeft: `${category.depth * 0.75}rem` }}>{category.path}</span>
                {checked ? <Check className="size-4 text-primary" /> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CategoryPickerTrigger({
  selectedNames,
  selected,
  className,
  appearance = "button",
}: {
  selectedNames: string;
  selected: FlatCategory[];
  className?: string;
  appearance?: "button" | "field";
}) {
  const label = (
    <span className={selected.length ? "text-on-surface" : "text-on-surface-variant"}>
      {selectedNames}
    </span>
  );

  if (appearance === "field") {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(fieldAppearanceTriggerClassName, className)}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondaryOutline"
      className={cn("min-h-12 w-full justify-start text-left", className)}
    >
      {label}
    </Button>
  );
}

function CategoryPickerOverlays({
  flat,
  value,
  toggle,
  open,
  onOpenChange,
  selectedNames,
  selected,
  triggerClassName,
  appearance = "button",
}: {
  flat: FlatCategory[];
  value: string[];
  toggle: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNames: string;
  selected: FlatCategory[];
  triggerClassName?: string;
  appearance?: "button" | "field";
}) {
  const list = <CategoryCommandList flat={flat} value={value} onToggle={toggle} />;
  const { mobile, desktop } = useSplitOverlayOpen(open, onOpenChange);
  const triggerProps = {
    selectedNames,
    selected,
    appearance,
    ...(triggerClassName ? { className: triggerClassName } : {}),
  };

  return (
    <>
      <Popover {...desktop}>
        <PopoverTrigger asChild className="hidden md:inline-flex">
          <CategoryPickerTrigger {...triggerProps} />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="hidden w-[min(28rem,calc(100vw-2rem))] p-0 md:block"
        >
          {list}
        </PopoverContent>
      </Popover>

      <BottomSheet {...mobile}>
        <BottomSheetTrigger asChild className="md:hidden">
          <CategoryPickerTrigger {...triggerProps} />
        </BottomSheetTrigger>
        <BottomSheetContent
          overlayClassName="md:hidden"
          className="md:hidden max-h-[min(85dvh,36rem)]"
        >
          <BottomSheetHeader className="px-6 pt-2 text-left">
            <BottomSheetTitle className="font-headline text-lg">Categories</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="px-6 pb-6">{list}</div>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Select categories",
  multiple = true,
  triggerClassName,
  compact = false,
  appearance = "button",
}: Props) {
  const [open, setOpen] = useState(false);
  const flat = useMemo(() => flattenCategories(categories), [categories]);
  const selected = flat.filter((category) => value.includes(category.id));
  const selectedNames: string =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (selected[0]?.path ?? placeholder)
        : `${selected[0]?.path ?? placeholder} + ${selected.length - 1} more`;

  const toggle = (id: string) => {
    if (!multiple) {
      onChange(value.includes(id) ? [] : [id]);
      setOpen(false);
      return;
    }
    if (value.includes(id)) {
      onChange(value.filter((categoryId) => categoryId !== id));
      return;
    }
    onChange([...value, id]);
  };

  const triggerFallback = (
    <>
      <CategoryPickerTrigger
        selectedNames={selectedNames}
        selected={selected}
        appearance={appearance}
        className={cn("hidden md:inline-flex", triggerClassName)}
      />
      <CategoryPickerTrigger
        selectedNames={selectedNames}
        selected={selected}
        appearance={appearance}
        className={cn("md:hidden", triggerClassName)}
      />
    </>
  );

  const overlayProps = {
    flat,
    value,
    toggle,
    open,
    onOpenChange: setOpen,
    selectedNames,
    selected,
    appearance,
    ...(triggerClassName ? { triggerClassName } : {}),
  };

  return (
    <div className={compact ? "space-y-0" : "space-y-3"}>
      <HydrationDeferred fallback={triggerFallback}>
        <CategoryPickerOverlays {...overlayProps} />
      </HydrationDeferred>

      {!compact && selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((category, index) => (
            <Button
              key={category.id}
              type="button"
              variant="ghost"
              className="h-auto min-h-0 rounded-full border border-outline-variant/30 px-3 py-1 font-body text-xs font-normal text-on-surface-variant hover:bg-transparent hover:border-link hover:text-link"
              onClick={() => toggle(category.id)}
            >
              {index === 0 ? "Primary: " : ""}
              {category.path} x
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
