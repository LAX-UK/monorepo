"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  title: string;
  images: string[];
};

export function ArtworkImageStage({ title, images }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const countId = useId();

  const img = images[index] ?? images[0];
  const hasMany = images.length > 1;
  const lightboxAlt = hasMany ? `${title} (${index + 1} of ${images.length})` : title;

  const close = useCallback(() => setLightboxOpen(false), []);

  const openLightbox = useCallback(() => {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    setLightboxOpen(true);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (lightboxOpen) {
      if (!el.open) {
        el.showModal();
        queueMicrotask(() => {
          el.querySelector<HTMLElement>('[data-lightbox-focus="true"]')?.focus();
        });
      }
    } else if (el.open) {
      el.close();
    }
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) {
      const t = window.setTimeout(() => {
        lastFocusRef.current?.focus?.();
      }, 0);
      return () => window.clearTimeout(t);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && hasMany) {
        e.preventDefault();
        setIndex((i) => (i + 1) % images.length);
      }
      if (e.key === "ArrowLeft" && hasMany) {
        e.preventDefault();
        setIndex((i) => (i - 1 + images.length) % images.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasMany, images.length, lightboxOpen]);

  if (!img) {
    return <div className="flex h-full items-center justify-center text-secondary">No image</div>;
  }

  return (
    <>
      <div className="group relative h-full">
        <Image
          src={img}
          alt={title}
          fill
          priority
          placeholder="blur"
          blurDataURL={TINY_IMAGE_BLUR}
          className="cursor-zoom-in bg-surface-container-low object-cover transition-transform duration-1000 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 lg:object-contain"
          sizes="50vw"
          onClick={openLightbox}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
        <button
          type="button"
          data-lightbox-opener="true"
          onClick={openLightbox}
          className="pointer-events-auto absolute bottom-6 right-6 flex items-center gap-2 rounded-md bg-surface-container-lowest/90 px-3 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface shadow-md backdrop-blur-sm transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MaterialIcon name="fullscreen" className="text-base" aria-hidden />
          Expand
        </button>
        {hasMany ? (
          <div className="pointer-events-auto absolute bottom-6 left-6 flex gap-2">
            {images.map((u, i) => (
              <button
                key={u}
                type="button"
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  i === index ? "bg-primary" : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="artwork-lightbox-dialog fixed inset-0 z-[100] box-border h-[100dvh] w-[100vw] max-h-[100dvh] max-w-[100vw] border-0 bg-transparent p-0 text-white backdrop:bg-black/90 motion-reduce:backdrop:transition-none"
        aria-labelledby={titleId}
        aria-describedby={hasMany ? countId : undefined}
        onClose={() => setLightboxOpen(false)}
      >
        <div className="flex h-[100dvh] min-h-0 w-full flex-col items-center justify-center p-4 motion-reduce:transition-none">
          <h2 id={titleId} className="sr-only">
            Fullscreen image: {title}
          </h2>
          {hasMany ? (
            <p id={countId} className="sr-only" aria-live="polite" aria-atomic="true">
              Image {index + 1} of {images.length}
            </p>
          ) : null}
          {hasMany ? (
            <p
              className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 font-label text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm"
              aria-hidden
            >
              {index + 1} / {images.length}
            </p>
          ) : null}
          <button
            type="button"
            data-lightbox-focus="true"
            className="absolute right-4 top-4 z-10 rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Close fullscreen"
            onClick={close}
          >
            <MaterialIcon name="close" className="text-3xl" />
          </button>
          <div className="relative h-[min(85dvh,900px)] min-h-[200px] w-full max-w-6xl shrink-0">
            <Image
              src={img}
              alt={lightboxAlt}
              fill
              className="object-contain motion-reduce:transition-none"
              sizes="100vw"
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
            />
          </div>
          {hasMany ? (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
                aria-label="Previous image"
                onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              >
                <MaterialIcon name="chevron_left" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
                aria-label="Next image"
                onClick={() => setIndex((i) => (i + 1) % images.length)}
              >
                <MaterialIcon name="chevron_right" />
              </button>
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
