"use client";

import { PanelHeading } from "@/features/saleroom/components/clerk-console/console-panel";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  title: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

export function CollapsibleConsoleSection({
  title,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  children,
  className,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <div className={cn("rounded-lg border border-outline-variant/25", className)}>
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between gap-3 p-4 text-left hover:bg-transparent"
        aria-expanded={open}
        onClick={toggle}
      >
        <PanelHeading as="span">{title}</PanelHeading>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-secondary transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </Button>
      {open ? (
        <div className="border-t border-outline-variant/20 px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </div>
  );
}
