"use client";

import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import * as React from "react";
import { cn } from "../lib/cn.js";

/**
 * A record's picture as a 56px square beside its title (a facts card, a panel header). Without
 * a picture, or when it cannot load, the shared hatched placeholder stands in, never an empty box
 * or the browser's broken-image glyph.
 */
export function RecordThumbnail({
  src,
  title,
  className,
}: {
  src: string | null;
  /** The record's title, read for the placeholder. */
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  // A picture that failed before the page hydrated never fires onError again: check on mount.
  const check = React.useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const box = cn(
    "relative size-14 shrink-0 overflow-hidden rounded-staff-sm border border-staff-line",
    className,
  );
  if (!src || failed) {
    return (
      <span className={box}>
        <MediaPlaceholder title={title} />
      </span>
    );
  }
  return (
    <span className={box}>
      <img
        ref={check}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full bg-staff-sunken object-cover"
      />
    </span>
  );
}
