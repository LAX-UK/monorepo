import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** Caps-label card for catalog detail overview tabs. */
export function CatalogInfoCard({ title, children, className }: Props) {
  return (
    <Surface
      variant="card"
      className={cn("border-border-hairline bg-surface-container-low/30 p-4", className)}
    >
      <h3 className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </Surface>
  );
}
