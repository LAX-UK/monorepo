"use client";

import { ShareActions } from "@/components/ui/share-actions";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { ExternalLinkIcon } from "lucide-react";

type Props = {
  url: string;
  headline: string;
  outletName: string;
  dateLabel?: string | null;
  publishedAt?: string | null;
  shareClassName?: string;
};

function buildExternalArticleLabel(outletName: string): string {
  return `Read on ${outletName} (opens in new tab)`;
}

export function PressCoverageCardActions({
  url,
  headline,
  outletName,
  dateLabel,
  publishedAt,
  shareClassName,
}: Props) {
  const externalLabel = buildExternalArticleLabel(outletName);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <ShareActions
          url={url}
          title={headline}
          {...(shareClassName ? { className: shareClassName } : {})}
        />
        {dateLabel ? (
          <time
            dateTime={publishedAt ?? undefined}
            className="font-body text-xs text-on-surface-variant/60"
          >
            {dateLabel}
          </time>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={externalLabel}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:text-link",
                FOCUS_RING,
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top">{`Read on ${outletName}`}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
