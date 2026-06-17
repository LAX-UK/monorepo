"use client";

import { PanelHeading } from "@/features/saleroom/components/clerk-console/console-panel";
import { cn } from "@auction/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function CollapsibleConsoleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border border-outline-variant/25", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <PanelHeading as="span">{title}</PanelHeading>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-secondary transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-outline-variant/20 px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </div>
  );
}
