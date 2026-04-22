"use client";

import { Button } from "@auction/ui/components/button";
import { Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

type Props = {
  url: string;
  title: string;
  className?: string;
  /** "text" = unstyled Figma row (use with `label` for custom icon+text). */
  appearance?: "default" | "text";
  /** Custom trigger content for `appearance="text"` (e.g. icon + "Share"). */
  label?: ReactNode;
};

export function ShareButton({ url, title, className, appearance = "default", label }: Props) {
  const [done, setDone] = useState(false);

  const share = useCallback(async () => {
    setDone(false);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setDone(true);
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      setDone(false);
    }
  }, [title, url]);

  if (appearance === "text") {
    return (
      <button
        type="button"
        onClick={() => void share()}
        className={
          className ??
          "inline-flex h-10 items-center gap-1.5 font-['DM_Sans',sans-serif] text-sm font-medium uppercase leading-[21px] text-[#1C170D] transition-opacity hover:opacity-80"
        }
      >
        {label ?? (
          <>
            <Share2 className="size-5 shrink-0 text-black" aria-hidden />
            {done ? "Copied" : "Share"}
          </>
        )}
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" className={className} onClick={() => void share()}>
      <Share2 className="text-base" aria-hidden />
      {done ? "Copied" : "Share"}
    </Button>
  );
}
