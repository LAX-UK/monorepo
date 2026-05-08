"use client";

import { MediaImage } from "@/components/ui/media-image";
import { Button } from "@auction/ui/components/button";
import { useMemo, useState } from "react";

type Props = {
  title: string;
  src: string;
  posterUrl?: string | null;
  /** Alt for poster image */
  posterAlt: string;
  withTwitchParent?: boolean;
  className?: string;
};

/** Defers heavy embed until the user opts in — improves LCP vs eager iframe.
 */
function srcWithCurrentHost(src: string): string {
  if (typeof window === "undefined") return src;
  const u = new URL(src, window.location.origin);
  u.searchParams.set("parent", window.location.hostname);
  return u.toString();
}

export function DeferredLiveIframe({
  title,
  src,
  posterUrl,
  posterAlt,
  withTwitchParent = false,
  className,
}: Props) {
  const [play, setPlay] = useState(false);
  const iframeSrc = useMemo(
    () => (withTwitchParent ? srcWithCurrentHost(src) : src),
    [src, withTwitchParent],
  );

  if (play) {
    return (
      <iframe
        title={title}
        src={iframeSrc}
        className={className}
        loading="eager"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div className="absolute inset-0">
      <MediaImage
        src={posterUrl}
        alt={posterAlt}
        label="Live stream"
        tone="dark"
        priority
        imgClassName="object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPlay(true)}
          className="h-auto rounded-md border-2 border-white/90 bg-black/40 px-8 py-4 font-label text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm hover:bg-black/55 hover:text-white"
        >
          Watch live
        </Button>
      </div>
    </div>
  );
}
