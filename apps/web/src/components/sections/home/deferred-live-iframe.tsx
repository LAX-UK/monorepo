"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  title: string;
  src: string;
  posterUrl?: string | null;
  /** Alt for poster image */
  posterAlt: string;
  className?: string;
};

/**
 * Defers heavy embed until the user opts in — improves LCP vs eager iframe.
 */
export function DeferredLiveIframe({ title, src, posterUrl, posterAlt, className }: Props) {
  const [play, setPlay] = useState(false);

  if (play) {
    return (
      <iframe
        title={title}
        src={src}
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
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={posterAlt}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <button
          type="button"
          onClick={() => setPlay(true)}
          className="rounded-md border-2 border-white/90 bg-black/40 px-8 py-4 font-label text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Watch live
        </button>
      </div>
    </div>
  );
}
