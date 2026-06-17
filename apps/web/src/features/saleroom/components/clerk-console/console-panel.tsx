import { cn } from "@auction/ui/lib/utils";
import type { ReactNode } from "react";

const PANEL_HEADING_CLASS =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export function PanelHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p" | "span";
}) {
  return <Tag className={cn(PANEL_HEADING_CLASS, className)}>{children}</Tag>;
}

export function ConsolePanel({
  children,
  className,
  variant = "bordered",
}: {
  children: ReactNode;
  className?: string;
  variant?: "bordered" | "plain";
}) {
  return (
    <div
      className={cn(
        variant === "bordered" && "rounded-lg border border-outline-variant/25 p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ConsoleSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn(PANEL_HEADING_CLASS, className)}>{children}</p>;
}

export { CollapsibleConsoleSection } from "@/features/saleroom/components/clerk-console/collapsible-console-section";
