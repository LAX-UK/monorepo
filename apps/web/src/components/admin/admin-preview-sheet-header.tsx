import { Button } from "@auction/ui/components/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  /** When omitted, no “Open full page” link is shown (queue-only drawers). */
  fullPageHref?: string;
  subtitle?: ReactNode;
};

/** Sheet drawer header with optional link to a full detail page. */
export function AdminPreviewSheetHeader({ title, fullPageHref, subtitle }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-hairline pb-4">
      <div className="min-w-0 space-y-1">
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Preview
        </p>
        <h2 className="truncate font-display text-lg text-on-surface">{title}</h2>
        {subtitle}
      </div>
      {fullPageHref ? (
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
          <Link href={fullPageHref}>
            Open full page
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
