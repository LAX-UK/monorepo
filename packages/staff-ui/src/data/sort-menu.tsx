"use client";

import { ArrowUpDown } from "lucide-react";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuRadioGroup,
  StaffMenuRadioItem,
  StaffMenuTrigger,
} from "../primitives/menu.js";

export type SortOption<T extends string> = { value: T; label: string };

/**
 * The list's sort, always visible: a button naming the order in force ("Longest waiting") that
 * opens the choices. For lists whose order is not one column's (a wait counted in working
 * hours, a sale's date), where a header click would not say enough.
 */
export function SortMenu<T extends string>({
  value,
  options,
  onChange,
  label = "Sort",
}: {
  value: T;
  options: readonly SortOption<T>[];
  onChange: (value: T) => void;
  /** The menu's heading and the button's accessible prefix. */
  label?: string;
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          size="sm"
          variant="ghost"
          icon={<ArrowUpDown aria-hidden />}
          aria-label={`${label}: ${current?.label ?? ""}`}
        >
          {current?.label}
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end" className="w-52">
        <StaffMenuLabel>{label}</StaffMenuLabel>
        <StaffMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next);
            if (match) onChange(match.value);
          }}
        >
          {options.map((option) => (
            <StaffMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </StaffMenuRadioItem>
          ))}
        </StaffMenuRadioGroup>
      </StaffMenuContent>
    </StaffMenu>
  );
}
