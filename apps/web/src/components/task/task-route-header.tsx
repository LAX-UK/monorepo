"use client";

import { TaskRouteHeaderTitle } from "@/components/task/task-route-header-title";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function TaskHeaderBackLink({ className, hidden }: { className?: string; hidden?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className={cn(
        "min-h-[var(--tap-target-min,44px)] shrink-0 gap-1 px-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-on-surface",
        className,
      )}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden ? true : undefined}
    >
      <Link href="/" aria-label="Back to gallery">
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Back to gallery</span>
      </Link>
    </Button>
  );
}

export function TaskRouteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/onboarding/")) return null;

  return (
    <header className="sticky top-0 z-[var(--z-site-chrome,50)] border-b border-border-hairline bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_minmax(0,12rem)_1fr] items-center gap-2 px-4 sm:grid-cols-[1fr_minmax(0,16rem)_1fr] sm:px-6">
        <TaskHeaderBackLink className="justify-self-start" />
        <TaskRouteHeaderTitle />
        <TaskHeaderBackLink className="pointer-events-none invisible justify-self-end" hidden />
      </div>
    </header>
  );
}
