"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Props = {
  title: string;
  images: string[];
};

export function ArtworkImageStage({ title, images }: Props) {
  const [lightbox, setLightbox] = useState(false);
  const [index, setIndex] = useState(0);

  const img = images[index] ?? images[0];
  const hasMany = images.length > 1;

  const close = useCallback(() => setLightbox(false), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && hasMany) {
        setIndex((i) => (i + 1) % images.length);
      }
      if (e.key === "ArrowLeft" && hasMany) {
        setIndex((i) => (i - 1 + images.length) % images.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, hasMany, images.length, lightbox]);

  if (!img) {
    return (
      <div className="flex h-full items-center justify-center text-secondary">
        No image
      </div>
    );
  }

  return (
    <>
      <div className="group relative h-full">
        <Image
          src={img}
          alt={title}
          fill
          priority
          className="cursor-zoom-in bg-surface-container-low object-cover transition-transform duration-1000 group-hover:scale-105 lg:object-contain"
          sizes="50vw"
          onClick={() => setLightbox(true)}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100" />
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="absolute bottom-6 right-6 flex items-center gap-2 rounded-md bg-surface-container-lowest/90 px-3 py-2 font-label text-[9px] font-bold uppercase tracking-widest text-on-surface shadow-md backdrop-blur-sm transition-colors hover:bg-primary hover:text-on-primary pointer-events-auto"
        >
          <MaterialIcon name="fullscreen" className="text-base" />
          Expand
        </button>
        {hasMany ? (
          <div className="absolute bottom-6 left-6 flex gap-2 pointer-events-auto">
            {images.map((u, i) => (
              <button
                key={u}
                type="button"
                aria-label={`Show image ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? "bg-primary" : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image fullscreen"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
            onClick={close}
          >
            <MaterialIcon name="close" className="text-3xl" />
          </button>
          <div className="relative h-full w-full max-w-6xl">
            <Image src={img} alt={title} fill className="object-contain" sizes="100vw" priority />
          </div>
          {hasMany ? (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                aria-label="Previous image"
                onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              >
                <MaterialIcon name="chevron_left" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                aria-label="Next image"
                onClick={() => setIndex((i) => (i + 1) % images.length)}
              >
                <MaterialIcon name="chevron_right" />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
