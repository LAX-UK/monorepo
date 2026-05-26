import { Button } from "@auction/ui/components/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Minimal chrome for focused tasks (auth, onboarding) — no marketing mega nav or footer. */
export default function TaskLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-[var(--z-site-chrome,50)] border-b border-border-hairline bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="min-h-[var(--tap-target-min,44px)] gap-1 px-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-on-surface"
          >
            <Link href="/">
              <ChevronLeft className="size-4" aria-hidden />
              Back to gallery
            </Link>
          </Button>
        </div>
      </header>
      {children}
    </>
  );
}
