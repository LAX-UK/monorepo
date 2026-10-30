"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { MarketingShareIcon } from "./marketing-icons.js";

export type MarketingShareButtonProps = {
  url: string;
  title: string;
  className?: string;
  /**
   * "text" = unstyled Figma row (use with `label` for custom icon+text); "icon" = a circle the
   * size of the heart toggle, for a title row of icon actions.
   */
  appearance?: "default" | "text" | "icon";
  /** Custom trigger content for `appearance="text"` (e.g. icon + "Share"). */
  label?: ReactNode;
};

type ShareStatus = "idle" | "copied" | "error";

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

/** Web Share sheet when available, clipboard copy otherwise; outcome announced politely. */
export function MarketingShareButton({
  url,
  title,
  className,
  appearance = "default",
  label,
}: MarketingShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const share = useCallback(async () => {
    setStatus("idle");
    const absoluteUrl =
      typeof window !== "undefined" ? new URL(url, window.location.href).toString() : url;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url: absoluteUrl });
          return;
        } catch (e) {
          if (isAbortError(e)) return;
          throw e;
        }
      }
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }, [title, url]);

  const liveMessage =
    status === "copied" ? "Link copied" : status === "error" ? "Couldn't copy link" : "";

  const triggerLabel =
    status === "copied" ? "Copied" : status === "error" ? "Couldn't copy" : "Share";

  if (appearance === "text") {
    return (
      <>
        <output className="sr-only" aria-live="polite">
          {liveMessage}
        </output>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void share()}
          className={cn(
            className ??
              "inline-flex h-10 items-center gap-1.5 rounded-none px-0 font-label text-sm font-medium uppercase leading-[21px] text-nav-text hover:bg-transparent hover:opacity-80 dark:text-on-surface",
            "hover:bg-transparent hover:text-inherit",
          )}
        >
          {label ?? (
            <>
              <MarketingShareIcon className="stroke-current" />
              {triggerLabel}
            </>
          )}
        </Button>
      </>
    );
  }

  if (appearance === "icon") {
    // The same 40px circle in a 44px target as the heart toggle, so the pair sits as one set.
    return (
      <>
        <output className="sr-only" aria-live="polite">
          {liveMessage}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Share ${title}`}
          onClick={() => void share()}
          className={cn(
            "group/share size-11 min-h-11 min-w-11 rounded-full bg-transparent p-0 hover:bg-transparent",
            FOCUS_RING,
            className,
          )}
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface transition-colors group-hover/share:bg-surface-container-low motion-reduce:transition-none"
          >
            <MarketingShareIcon className="size-5" />
          </span>
        </Button>
      </>
    );
  }

  return (
    <>
      <output className="sr-only" aria-live="polite">
        {liveMessage}
      </output>
      <Button
        type="button"
        variant="secondaryOutline"
        className={className}
        onClick={() => void share()}
      >
        <MarketingShareIcon className="size-4" />
        {triggerLabel}
      </Button>
    </>
  );
}
