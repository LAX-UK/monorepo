import { cn } from "@auction/staff-ui";
import type { ReactNode } from "react";

const PANEL_HEADING_CLASS = "text-staff-md font-semibold text-staff-fg";

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

/** A block of the console: a hairline card, or `plain` when it already sits inside one. */
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
        variant === "bordered" && "rounded-staff-lg border border-staff-line bg-staff-surface p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A small label above a group of controls inside a panel. */
export function ConsoleSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("text-staff-sm font-medium text-staff-muted", className)}>{children}</p>;
}
