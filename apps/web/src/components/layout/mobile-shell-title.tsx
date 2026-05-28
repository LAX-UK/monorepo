"use client";

import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import { resolveMobileShellTitle } from "@/lib/navigation/mobile-shell-title";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = {
  items: readonly BreadcrumbItem[];
  className?: string;
};

/** Route-aware mobile page title for AppShell (below lg). */
export function MobileShellTitle({ items, className }: Props) {
  const model = resolveMobileShellTitle(items);

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1", className)}>
      {model.backHref ? (
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="size-11 shrink-0"
          aria-label={model.backLabel ? `Back to ${model.backLabel}` : "Go back"}
        >
          <Link href={model.backHref}>
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        {model.eyebrow ? (
          <p className="truncate font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {model.eyebrow}
          </p>
        ) : null}
        <h1 className="truncate font-headline text-base font-semibold leading-tight text-on-surface">
          {model.title}
        </h1>
      </div>
    </div>
  );
}
