"use client";

import { MediaImage } from "@/components/ui/media-image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import type { GalleryImage } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

const GalleryLightbox = dynamic(
  () => import("@/components/gallery/engine/gallery-lightbox").then((m) => m.GalleryLightbox),
  { ssr: false },
);

const NO_IMAGE_LABEL = "No image yet";

/** The work on the warm paper mat; a drop shadow follows the picture, not its box. */
const WORK_SHADOW =
  "[filter:drop-shadow(0_1px_1px_rgb(0_0_0/.12))_drop-shadow(0_12px_16px_rgb(0_0_0/.22))] dark:[filter:drop-shadow(0_1px_1px_rgb(0_0_0/.45))_drop-shadow(0_10px_14px_rgb(0_0_0/.55))]";

type Props = {
  title: string;
  images: GalleryImage[];
};

/**
 * The image stage: the work on a paper mat, square on a desk and wider than tall on a phone,
 * with thumbnails below and a full-screen viewer. A lot without an image shows the established
 * hatched placeholder across the mat.
 */
export function LotImageStage({ title, images }: Props) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const current = images[index] ?? images[0];

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "relative -mx-4 flex aspect-[5/4] items-center justify-center bg-lax-paper p-6",
          "md:mx-0 md:aspect-square md:rounded-xl md:p-12 lg:p-16",
        )}
      >
        {current ? (
          <>
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
            <Button
              size="sm"
              variant="secondary"
              icon={<Maximize2 aria-hidden />}
              onClick={() => setViewerOpen(true)}
              aria-haspopup="dialog"
              className="absolute right-4 bottom-4"
            >
              View larger
            </Button>
          </>
        ) : (
          <MediaPlaceholder fill label={NO_IMAGE_LABEL} title={title} className="md:rounded-xl" />
        )}
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 flex list-none gap-2 overflow-x-auto p-0 pb-1" aria-label="Images">
          {images.map((image, i) => (
            <li key={image.src}>
              <Button
                variant="ghost"
                aria-label={`Image ${i + 1} of ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-16 overflow-hidden rounded-md bg-lax-paper p-2.5 hover:bg-lax-paper",
                  "ring-1 ring-lax-line ring-inset hover:ring-lax-line-hover",
                  "aria-[current=true]:ring-2 aria-[current=true]:ring-lax-fg",
                )}
              >
                <span className="relative block size-full">
                  <MediaImage
                    src={image.src}
                    alt=""
                    sizes="64px"
                    className="overflow-visible"
                    imgClassName="object-contain"
                  />
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {viewerOpen ? (
        <GalleryLightbox
          images={images}
          index={index}
          open={viewerOpen}
          onIndexChange={setIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}
