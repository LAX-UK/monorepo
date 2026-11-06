"use client";

import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import {
  EmptyStage,
  LotMediaStrip,
  type LotMediaViewProps,
  NO_IMAGE_LABEL,
  ViewerButton,
} from "./lot-media-parts";

/** The work on the warm paper mat; a drop shadow follows the picture, not its box. */
const WORK_SHADOW =
  "[filter:drop-shadow(0_1px_1px_rgb(0_0_0/.12))_drop-shadow(0_12px_16px_rgb(0_0_0/.22))] dark:[filter:drop-shadow(0_1px_1px_rgb(0_0_0/.45))_drop-shadow(0_10px_14px_rgb(0_0_0/.55))]";

/**
 * Wall: the work on a paper mat, square on a desk and wider than tall on a phone, with its
 * thumbnails below. A lot without an image shows the established hatched placeholder across
 * the mat.
 */
export function SingleView({
  title,
  images,
  index,
  onIndexChange,
  onOpenViewer,
  stripLabel,
}: LotMediaViewProps) {
  const current = images[index] ?? images[0];
  if (!current) return <EmptyStage title={title} />;
  return (
    <>
      <div
        className={cn(
          "relative -mx-4 flex aspect-[5/4] items-center justify-center bg-lax-paper p-6",
          "md:mx-0 md:aspect-square md:rounded-xl md:p-12 lg:p-16",
        )}
      >
        <MediaImage
          key={current.src}
          src={current.src}
          alt={current.alt ?? title}
          label={NO_IMAGE_LABEL}
          sizes="(min-width: 1024px) 56vw, 100vw"
          priority={index === 0}
          className="overflow-visible"
          imgClassName={cn("object-contain", WORK_SHADOW)}
        />
        <ViewerButton onClick={() => onOpenViewer()} />
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
