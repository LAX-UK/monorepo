"use client";

import { CommandInput } from "@auction/ui";

type PaletteVariant = "marketing" | "dashboard" | "admin";

const PLACEHOLDERS: Record<PaletteVariant, string> = {
  admin: "Search pages, lots, payments, clients…",
  marketing: "Search lots, artists, sales…",
  dashboard: "Search your dashboard…",
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  variant?: PaletteVariant;
};

export function PaletteSearch({ value, onValueChange, variant = "admin" }: Props) {
  return (
    <div className="border-b border-border-hairline px-1">
      <CommandInput
        value={value}
        onValueChange={onValueChange}
        placeholder={PLACEHOLDERS[variant]}
        className="h-11 border-0 font-body text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
