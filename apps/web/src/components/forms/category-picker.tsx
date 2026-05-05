"use client";

import { Button } from "@/components/ui/button";
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
};

function flattenCategories(categories: CategoryNode[], parentPath = "", depth = 0): FlatCategory[] {
  return categories.flatMap((category) => {
    const path = parentPath ? `${parentPath} / ${category.name}` : category.name;
    return [{ ...category, path, depth }, ...flattenCategories(category.children, path, depth + 1)];
  });
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Select categories",
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
    if (value.includes(id)) {
      onChange(value.filter((categoryId) => categoryId !== id));
      return;
    }
    onChange([...value, id]);
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-start text-left">
            <span className={selected.length ? "" : "text-on-surface-variant"}>
              {selectedNames}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {flat.map((category) => {
                  const checked = value.includes(category.id);
                  return (
                    <CommandItem
                      key={category.id}
                      value={`${category.path} ${category.slug}`}
                      onSelect={() => toggle(category.id)}
                      className="justify-between"
                    >
                      <span style={{ paddingLeft: `${category.depth * 0.75}rem` }}>
                        {category.path}
                      </span>
                      {checked ? <Check className="size-4 text-primary" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
