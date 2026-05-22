"use client";

import { type OverlaySlotDef, OverlayToneProvider } from "@/components/ui/overlay-tone-context";
import { DEFAULT_OVERLAY_TONE, useImageOverlayTones } from "@/hooks/use-image-overlay-tones";
import type { ObjectFitMode } from "@/lib/media/overlay-tone-types";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { cn } from "@auction/ui";
import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type FrameRefsContextValue = {
  containerRef: RefObject<HTMLDivElement | null>;
  imageRef: RefObject<HTMLImageElement | null>;
  onImageLoad: () => void;
  containerRefOnRoot: boolean;
};

const FrameRefsContext = createContext<FrameRefsContextValue | null>(null);

export type AdaptiveMediaFrameProps = {
  src: string | null | undefined;
  objectFit: ObjectFitMode;
  slots: OverlaySlotDef[];
  className?: string;
  /** When false, children still render but tones stay at default light. */
  enabled?: boolean;
  /**
   * When true, `containerRef` is on the frame root (for sized shells without
   * `AdaptiveMediaFrameContainer`). When false, ref lives on the inner container.
   */
  containerRefOnRoot?: boolean;
  children: ReactNode;
};

/**
 * Wraps marketing media shells with per-slot overlay tone sampling.
 * v1: brief default-then-resolve flash is expected — Phase 2 server metadata is out of scope.
 */
export function AdaptiveMediaFrame({
  src,
  objectFit,
  slots,
  className,
  enabled = true,
  containerRefOnRoot = false,
  children,
}: AdaptiveMediaFrameProps) {
  const normalizedSrc = resolveMediaSrc(src);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoadTick, setImageLoadTick] = useState(0);

  const { tones, resolved } = useImageOverlayTones({
    src: normalizedSrc,
    objectFit,
    slots,
    containerRef,
    imageRef,
    enabled: enabled && Boolean(normalizedSrc),
    imageLoadTick,
  });

  const onImageLoad = useCallback(() => {
    setImageLoadTick((n) => n + 1);
  }, []);

  const refsValue = useMemo<FrameRefsContextValue>(
    () => ({ containerRef, imageRef, onImageLoad, containerRefOnRoot }),
    [containerRefOnRoot, onImageLoad],
  );

  const toneValue = useMemo(() => ({ tones, resolved }), [resolved, tones]);

  return (
    <OverlayToneProvider value={toneValue}>
      <FrameRefsContext.Provider value={refsValue}>
        <div
          ref={containerRefOnRoot ? containerRef : undefined}
          className={cn(
            "relative w-full min-w-0",
            "motion-safe:transition-opacity motion-safe:duration-[var(--motion-duration-xs,120ms)] motion-reduce:transition-none",
            className,
          )}
          data-overlay-resolved={resolved ? "true" : "false"}
        >
          {children}
        </div>
      </FrameRefsContext.Provider>
    </OverlayToneProvider>
  );
}

function useFrameRefs(): FrameRefsContextValue {
  const ctx = useContext(FrameRefsContext);
  if (!ctx) {
    throw new Error("AdaptiveMediaFrameContainer must be used within AdaptiveMediaFrame");
  }
  return ctx;
}

/** Sized image bounds — attach sizing classes here unless using `containerRefOnRoot` on the frame. */
export function AdaptiveMediaFrameContainer(props: React.ComponentProps<"div">) {
  return <MediaContainer {...props} />;
}

function MediaContainer({ className, children, ...props }: React.ComponentProps<"div">) {
  const frameCtx = useContext(FrameRefsContext);
  if (frameCtx && !frameCtx.containerRefOnRoot) {
    return (
      <div ref={frameCtx.containerRef} className={className} {...props}>
        {children}
      </div>
    );
  }
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

/** Pass-through props for MediaImage inside a frame. */
export function useAdaptiveMediaImageProps(): {
  imgRef: RefObject<HTMLImageElement | null>;
  onImageLoad: () => void;
} {
  const { imageRef, onImageLoad } = useFrameRefs();
  return { imgRef: imageRef, onImageLoad };
}

export { DEFAULT_OVERLAY_TONE };
