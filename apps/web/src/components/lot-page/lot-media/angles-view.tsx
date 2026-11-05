"use client";

import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
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
   * `contain` shows the piece whole on the studio ground (objects). `fill` fills the frame and
   * opens to zoom on a click (products).
   */
  mode: "contain" | "fill";
};

/**
 * Object and product: one picture on a plain studio ground, no shadow, with a strip of angles
 * below. A product fills its frame and zooms on a click.
 */
export function AnglesView({
  title,
  images,
  index,
  onIndexChange,
  onOpenViewer,
  stripLabel,
  mode,
}: Props) {
  const current = images[index] ?? images[0];
  if (!current) return <EmptyStage title={title} />;
  const fill = mode === "fill";
  return (
    <>
      <div
        className={cn(
          STAGE_BOX,
          STUDIO_GROUND,
          "flex aspect-[5/4] items-center justify-center overflow-hidden md:aspect-square",
          fill ? "p-0" : "p-6 md:p-12 lg:p-16",
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
          imgClassName={fill ? "object-cover" : "object-contain"}
        />
        {fill ? (
          <button
            type="button"
            onClick={() => onOpenViewer()}
            aria-haspopup="dialog"
            aria-label={`Zoom in on ${title}`}
            className="lax-focus absolute inset-0 cursor-zoom-in md:rounded-xl"
          />
        ) : null}
        <ViewerButton onClick={() => onOpenViewer()} zoom={fill} />
      </div>
      <LotMediaStrip
        images={images}
        index={index}
        onSelect={onIndexChange}
        label={stripLabel}
        fit={fill ? "cover" : "contain"}
      />
    </>
  );
}
