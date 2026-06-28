"use client";

import { FOCUS_RING } from "@/lib/marketing/chrome";
import { buildLinkedInShareUrl, buildTwitterShareUrl } from "@/lib/marketing/share-urls";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { Check, Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type ShareTarget = "copy" | "twitter" | "linkedin";

type Props = {
  url: string;
  title: string;
  targets?: ShareTarget[];
  className?: string;
};

type CopyStatus = "idle" | "copied" | "error";

const TARGET_LABELS: Record<ShareTarget, string> = {
  copy: "Copy link",
  twitter: "Share on X",
  linkedin: "Share on LinkedIn",
};

const ICON_BUTTON_CLASS = cn(
  "min-h-11 min-w-11 rounded-full text-on-surface-variant hover:text-link",
  FOCUS_RING,
);

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>LinkedIn</title>
      <path
        fill="currentColor"
        d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 8.75h4V21H3V8.75Zm7.5 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v7.5h-4V15c0-1.6 0-3.6-2.2-3.6-2.2 0-2.5 1.7-2.5 3.5V21h-4V8.75Z"
      />
    </svg>
  );
}

function openShareWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function getCopyLabel(status: CopyStatus): string {
  if (status === "copied") return "Link copied";
  if (status === "error") return "Couldn't copy link";
  return TARGET_LABELS.copy;
}

function getLiveMessage(status: CopyStatus): string {
  if (status === "copied") return "Link copied";
  if (status === "error") return "Couldn't copy link";
  return "";
}

export function ShareActions({
  url,
  title,
  targets = ["copy", "twitter", "linkedin"],
  className,
}: Props) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleShare = useCallback(
    async (target: ShareTarget) => {
      if (target === "copy") {
        setCopyStatus("idle");
        try {
          await navigator.clipboard.writeText(url);
          setCopyStatus("copied");
        } catch {
          setCopyStatus("error");
        }
        return;
      }

      if (target === "twitter") {
        openShareWindow(buildTwitterShareUrl(url, title));
        return;
      }

      openShareWindow(buildLinkedInShareUrl(url));
    },
    [title, url],
  );

  return (
    <section className={cn("flex items-center gap-1", className)} aria-label="Share article">
      <output className="sr-only" aria-live="polite">
        {getLiveMessage(copyStatus)}
      </output>
      {targets.map((target) => {
        const label = target === "copy" ? getCopyLabel(copyStatus) : TARGET_LABELS[target];
        const Icon =
          target === "copy"
            ? copyStatus === "copied"
              ? Check
              : Copy
            : target === "twitter"
              ? Share2
              : LinkedInIcon;

        return (
          <Tooltip key={target}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={ICON_BUTTON_CLASS}
                aria-label={label}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleShare(target);
                }}
              >
                <Icon className="size-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </section>
  );
}
