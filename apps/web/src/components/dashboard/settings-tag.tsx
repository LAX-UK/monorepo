import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type SettingsTagVariant = "neutral" | "success" | "outline";

type SettingsTagProps = {
  children: ReactNode;
  variant?: SettingsTagVariant;
  className?: string;
};

const VARIANT: Record<SettingsTagVariant, string> = {
  neutral: "border border-outline-variant/40 bg-surface-container-high text-on-surface shadow-sm",
  success: "bg-success text-on-success",
  outline: "border border-outline-variant/50 bg-surface-container-lowest text-on-surface",
};

/** Small pill for defaults, verified, etc. */
export function SettingsTag({ children, variant = "neutral", className }: SettingsTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-wide",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
