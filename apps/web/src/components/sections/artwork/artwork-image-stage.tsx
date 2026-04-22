"use client";

import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { Button } from "@auction/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  title: string;
  images: string[];
  /** Optional per-index alt text (parallel to `images`) */
  imageAlts?: (string | undefined)[] | undefined;
};

const SWIPE_PX = 48;

export function ArtworkImageStage({ title, images, imageAlts }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const countId = useId();
  const touchStartX = useRef<number | null>(null);

  const altAt = useCallback(
    (i: number, context: "hero" | "lightbox") => {
      const custom = imageAlts?.[i];
      if (custom?.trim()) return custom.trim();
      if (images.length > 1) {
        return context === "lightbox"
          ? `${title} (${i + 1} of ${images.length})`
          : `${title} — image ${i + 1} of ${images.length}`;
      }
      return title;
    },
    [imageAlts, images.length, title],
  );

  const img = images[index] ?? images[0];
  const hasMany = images.length > 1;
  const lightboxAlt = altAt(index, "lightbox");

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!hasMany) return;
      setIndex((i) => (i + dir + images.length) % images.length);
    },
    [hasMany, images.length],
  );

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
        go(1);
      }
      if (e.key === "ArrowLeft" && hasMany) {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, hasMany, lightboxOpen]);

  useEffect(() => {
    if (lightboxOpen || !hasMany) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, hasMany, lightboxOpen]);

  if (!img) {
    return <div className="flex h-full items-center justify-center text-secondary">No image</div>;
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="group relative h-full touch-pan-y"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || !hasMany) return;
          const end = e.changedTouches[0]?.clientX;
          if (end == null) return;
          const dx = end - start;
          if (dx > SWIPE_PX) go(-1);
          else if (dx < -SWIPE_PX) go(1);
        }}
      >
        <Image
          src={img}
          alt={altAt(index, "hero")}
          fill
          priority
          placeholder="blur"
          blurDataURL={TINY_IMAGE_BLUR}
          className="cursor-zoom-in bg-surface-container-low object-cover transition-transform duration-1000 motion-safe:group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 lg:object-contain"
          sizes="50vw"
          onClick={openLightbox}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-lightbox-opener="true"
              onClick={openLightbox}
              className="pointer-events-auto absolute bottom-6 right-6 h-auto rounded-md bg-surface-container-lowest/90 px-3 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface shadow-md backdrop-blur-sm hover:bg-primary hover:text-on-primary"
            >
              <Maximize2 className="size-4" aria-hidden />
              Expand
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open fullscreen view</TooltipContent>
        </Tooltip>
        {hasMany ? (
          <div className="pointer-events-auto absolute bottom-6 left-6 flex gap-1">
            {images.map((u, i) => (
              <Button
                key={u}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`min-h-11 min-w-11 rounded-full ${
                  i === index ? "bg-primary hover:bg-primary" : "bg-white/50 hover:bg-white/80"
                }`}
              >
                <span className="sr-only">Image {i + 1}</span>
                <span
                  className={`block h-2.5 w-2.5 rounded-full ${i === index ? "bg-white" : "bg-on-surface"}`}
                  aria-hidden
                />
              </Button>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-lightbox-focus="true"
                className="absolute right-4 top-4 z-10 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close fullscreen"
                onClick={close}
              >
                <X className="size-6" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 z-10 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 hover:text-white motion-reduce:transition-none"
                    aria-label="Previous image"
                    onClick={() => go(-1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous (←)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 z-10 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 hover:text-white motion-reduce:transition-none"
                    aria-label="Next image"
                    onClick={() => go(1)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next (→)</TooltipContent>
              </Tooltip>
            </>
          ) : null}
        </div>
      </dialog>
    </TooltipProvider>
  );
}
