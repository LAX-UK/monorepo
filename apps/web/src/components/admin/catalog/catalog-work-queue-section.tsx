"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";

type Props = {
  id: string;
  title: string;
  count?: number;
  description?: string;
  primaryAction?: { label: string; href: string };
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/** Titled, collapsible block for composite catalog work queues (e.g. lots attention lens). */
export function CatalogWorkQueueSection({
  id,
  title,
  count,
  description,
  primaryAction,
  defaultOpen = true,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headingId = `${id}-heading`;

  return (
    <section
      className={cn(
        "rounded-lg border border-border-hairline bg-surface-container-low/30",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-hairline/60 px-3 py-3">
        <Button
          type="button"
          variant="ghost"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          id={headingId}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-on-surface-variant transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
          <span className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            {title}
            {count != null ? (
              <span className="ms-2 font-mono tabular-nums text-on-surface">({count})</span>
            ) : null}
          </span>
        </Button>
        {primaryAction ? (
          <Link
            href={primaryAction.href}
            className="min-h-11 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
          >
            {primaryAction.label}
          </Link>
        ) : null}
      </div>
      {description ? (
        <p className="px-3 pt-2 font-body text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {open ? (
        <div id={panelId} className="space-y-3 p-3" aria-labelledby={headingId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
