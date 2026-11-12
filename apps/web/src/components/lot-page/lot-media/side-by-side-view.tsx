"use client";

import { MediaImage } from "@/components/ui/media-image";
import { spreadPages } from "@/lib/lot-page/lot-media-plan";
import { Button } from "@auction/ui/lax/button";
import { cn } from "@auction/ui/lib/utils";
import {
  EmptyStage,
  LotMediaStrip,
  type LotMediaViewProps,
  NO_IMAGE_LABEL,
  STAGE_BOX,
  STUDIO_GROUND,
  ViewerButton,
} from "./lot-media-parts";

type Props = LotMediaViewProps & {
  /**
   * `faces` shows the first two pictures with a caption each (obverse and reverse); `spread`
   * shows the pair of pages the current page falls in.
   */
  mode: "faces" | "spread";
};

const FACE_CAPTIONS = ["Obverse", "Reverse"] as const;

/**
 * Two pictures side by side on the studio ground, each opening to zoom: the two faces of a coin
 * or medal, or an open book's spread.
 */
export function SideBySideView({
  title,
  images,
  index,
  onIndexChange,
  onOpenViewer,
  stripLabel,
  mode,
}: Props) {
  if (images.length === 0) return <EmptyStage title={title} />;
  const pages =
    mode === "faces" ? [0, 1].filter((i) => images[i]) : spreadPages(index, images.length);
  const faces = mode === "faces";
  return (
    <>
      <div
        className={cn(
          STAGE_BOX,
          STUDIO_GROUND,
          "flex aspect-[5/4] justify-center gap-px overflow-hidden md:aspect-[4/3]",
          faces ? "items-center" : "items-stretch",
        )}
      >
        {pages.map((pageIndex, position) => {
          const image = images[pageIndex];
          if (!image) return null;
          const caption = faces ? FACE_CAPTIONS[position] : null;
          return (
            <figure
              key={image.src}
              className={cn(
                "relative m-0 flex min-w-0 flex-1 flex-col items-center justify-center p-3 md:p-8",
                pages.length === 2 && position === 0 && !faces && "border-r border-lax-line",
              )}
            >
              <div className={cn("relative w-full", faces ? "aspect-square" : "min-h-0 flex-1")}>
                <MediaImage
                  src={image.src}
                  alt={image.alt ?? (caption ? `${title}, ${caption.toLowerCase()}` : title)}
                  label={NO_IMAGE_LABEL}
                  sizes="(min-width: 1024px) 28vw, 50vw"
                  priority={position === 0}
                  className="overflow-visible"
                  imgClassName="object-contain"
                />
                <Button
                  variant="ghost"
                  onClick={() => onOpenViewer(pageIndex)}
                  aria-haspopup="dialog"
                  aria-label={`Zoom in on ${caption ?? `page ${pageIndex + 1}`}`}
                  className="absolute inset-0 size-full cursor-zoom-in rounded-md p-0 hover:bg-transparent"
                />
              </div>
              {caption ? (
                <figcaption className="mt-2 text-lax-13 text-lax-muted">{caption}</figcaption>
              ) : null}
            </figure>
          );
        })}
        <ViewerButton onClick={() => onOpenViewer(pages[0])} zoom />
      </div>
      <LotMediaStrip
        images={images}
        index={index}
        onSelect={onIndexChange}
        label={stripLabel}
        fit="contain"
      />
    </>
  );
}
