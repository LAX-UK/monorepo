import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p";
  id?: string;
};

/** Canonical uppercase section label for admin detail panels and rails. */
export function AdminSectionLabel({ children, className, as: Tag = "h3", id }: Props) {
  return (
    <Tag
      id={id}
      className={cn(
        "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
