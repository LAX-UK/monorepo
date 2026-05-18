"use client";

import { Button } from "@/components/ui/button";
import { useIsMd } from "@/hooks/use-is-md";
import type { CategoryNode } from "@auction/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
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
  const isMd = useIsMd();
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
    <Button type="button" variant="secondary" className="min-h-12 w-full justify-start text-left">
      <span className={selected.length ? "" : "text-on-surface-variant"}>{selectedNames}</span>
    </Button>
  );

  const list = <CategoryCommandList flat={flat} value={value} onToggle={toggle} />;

  return (
    <div className="space-y-3">
      {isMd ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
            {list}
          </PopoverContent>
        </Popover>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[min(85dvh,36rem)] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle className="font-headline text-left text-lg">Categories</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{list}</div>
          </SheetContent>
        </Sheet>
      )}
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((category, index) => (
            <button
              key={category.id}
              type="button"
              onClick={() => toggle(category.id)}
              className="rounded-full border border-outline-variant/30 px-3 py-1 font-body text-xs text-on-surface-variant hover:border-primary hover:text-primary"
            >
              {index === 0 ? "Primary: " : ""}
              {category.path} x
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
