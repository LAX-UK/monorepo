"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./menu.js";

export type SelectMenuOption<T extends string> = { value: T; label: string };

export type SelectMenuProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectMenuOption<T>[];
  /** What is being chosen, said before the current choice: "Role for Maya Okafor". */
  label: string;
  disabled?: boolean;
  /** The trigger's width: a list filter or a column of role pickers lines up at one width. */
  className?: string;
  size?: "sm" | "md";
};

/**
 * Choose one of a few values from a button that names the current one: a list filter ("All
 * roles"), a role in a row. A menu of radio items, so it reads as a choice to assistive
 * technology and works from the keyboard like every other menu; the button keeps the field's
 * height and edge so it lines up with search fields and inputs beside it.
 */
export function SelectMenu<T extends string>({
  value,
  onValueChange,
  options,
  label,
  disabled,
  className,
  size = "md",
}: SelectMenuProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <Button
          size={size}
          aria-label={`${label}: ${current?.label ?? ""}`}
          className={cn("justify-between gap-2 font-normal", className)}
        >
          <span className="truncate">{current?.label ?? label}</span>
          <ChevronDown aria-hidden className="text-lax-muted" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[max(var(--radix-dropdown-menu-trigger-width),12rem)]">
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next);
            if (match) onValueChange(match.value);
          }}
        >
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
