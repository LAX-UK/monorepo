"use client";

import { Button } from "@auction/ui/components/button";
import { Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  url: string;
  title: string;
  className?: string;
  /** "text" = unstyled Figma row (use with `label` for custom icon+text). */
  appearance?: "default" | "text";
  /** Custom trigger content for `appearance="text"` (e.g. icon + "Share"). */
  label?: ReactNode;
};

type ShareStatus = "idle" | "copied" | "error";

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

export function ShareButton({ url, title, className, appearance = "default", label }: Props) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const share = useCallback(async () => {
    setStatus("idle");
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          setStatus("copied");
          return;
        } catch (e) {
          if (isAbortError(e)) return;
          throw e;
        }
      }
      await navigator.clipboard.writeText(url);
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
          className={
            className ??
            "inline-flex h-10 items-center gap-1.5 rounded-none px-0 font-['DM_Sans',sans-serif] text-sm font-medium uppercase leading-[21px] text-nav-text hover:bg-transparent hover:opacity-80 dark:text-on-surface"
          }
        >
          {label ?? (
            <>
              <Share2
                className="size-5 shrink-0 text-black dark:text-on-surface"
                strokeWidth={1}
                aria-hidden
              />
              {triggerLabel}
            </>
          )}
        </Button>
      </>
    );
  }

  return (
    <>
      <output className="sr-only" aria-live="polite">
        {liveMessage}
      </output>
      <Button type="button" variant="outline" className={className} onClick={() => void share()}>
        <Share2 className="text-base" aria-hidden />
        {triggerLabel}
      </Button>
    </>
  );
}
