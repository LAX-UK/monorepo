"use client";

import { useSplitOverlayOpen } from "@/hooks/use-split-overlay-open";
import type { CategoryNode } from "@auction/types";
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

type Props = {
  categories: CategoryNode[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
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

export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Select categories",
  multiple = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const flat = useMemo(() => flattenCategories(categories), [categories]);
  const selected = flat.filter((category) => value.includes(category.id));
  const selectedNames =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]?.path
        : `${selected[0]?.path} + ${selected.length - 1} more`;

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

  const trigger = (
    <Button
      type="button"
      variant="secondaryOutline"
      className="min-h-12 w-full justify-start text-left"
    >
      <span className={selected.length ? "" : "text-on-surface-variant"}>{selectedNames}</span>
    </Button>
  );

  const list = <CategoryCommandList flat={flat} value={value} onToggle={toggle} />;
  const { mobile, desktop } = useSplitOverlayOpen(open, setOpen);

  return (
    <div className="space-y-3">
      <Popover {...desktop}>
        <PopoverTrigger asChild className="hidden md:inline-flex">
          {trigger}
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
          {trigger}
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

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((category, index) => (
            <Button
              key={category.id}
              type="button"
              variant="ghost"
              className="h-auto min-h-0 rounded-full border border-outline-variant/30 px-3 py-1 font-body text-xs font-normal text-on-surface-variant hover:bg-transparent hover:border-primary hover:text-primary"
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
