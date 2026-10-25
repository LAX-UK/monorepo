import type { ArtworkScaleVm } from "@/lib/presenters/artwork-scale.presenter";
import { cn } from "@auction/ui";

/**
 * The artwork drawn to scale above a sofa. The drawing's units are centimetres, so the work and
 * the sofa keep their real proportions to each other; the photograph fills the work's outline
 * without cropping.
 */
export function ArtworkScaleFigure({
  scale,
  imageUrl,
  className,
}: {
  scale: ArtworkScaleVm;
  imageUrl: string | null;
  className?: string;
}) {
  const { scene, artwork, sofa } = scale;
  const sofaBodyTop = sofa.y + (sofa.height - sofa.seatHeight) * 0.55;
  const armWidth = sofa.width * 0.09;
  const legHeight = sofa.height * 0.1;
  const floorY = scene.height;

  return (
    <figure className={cn("shop-scale", className)}>
      <svg
        className="shop-scale__drawing"
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        role="img"
        aria-label={scale.description}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Floor */}
        <line
          x1={0}
          x2={scene.width}
          y1={floorY - 0.5}
          y2={floorY - 0.5}
          className="shop-scale__floor"
        />
        {/* Sofa: back, seat, arms and legs, as a simple outline. */}
        <g className="shop-scale__sofa">
          <rect
            x={sofa.x + armWidth * 0.6}
            y={sofa.y}
            width={sofa.width - armWidth * 1.2}
            height={sofaBodyTop - sofa.y + 4}
            rx={4}
          />
          <rect
            x={sofa.x}
            y={sofaBodyTop}
            width={sofa.width}
            height={floorY - legHeight - sofaBodyTop}
            rx={4}
          />
          <rect
            x={sofa.x}
            y={sofa.y + sofa.height * 0.32}
            width={armWidth}
            height={floorY - legHeight - (sofa.y + sofa.height * 0.32)}
            rx={4}
          />
          <rect
            x={sofa.x + sofa.width - armWidth}
            y={sofa.y + sofa.height * 0.32}
            width={armWidth}
            height={floorY - legHeight - (sofa.y + sofa.height * 0.32)}
            rx={4}
          />
          <line
            x1={sofa.x + armWidth * 1.5}
            x2={sofa.x + armWidth * 1.5}
            y1={floorY - legHeight}
            y2={floorY}
          />
          <line
            x1={sofa.x + sofa.width - armWidth * 1.5}
            x2={sofa.x + sofa.width - armWidth * 1.5}
            y1={floorY - legHeight}
            y2={floorY}
          />
        </g>
        {/* The work, at its catalogued height and width. */}
        <rect
          x={artwork.x}
          y={artwork.y}
          width={artwork.width}
          height={artwork.height}
          className="shop-scale__work-ground"
        />
        {imageUrl ? (
          <image
            href={imageUrl}
            x={artwork.x}
            y={artwork.y}
            width={artwork.width}
            height={artwork.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}
        <rect
          x={artwork.x}
          y={artwork.y}
          width={artwork.width}
          height={artwork.height}
          className="shop-scale__work-edge"
        />
      </svg>
      <figcaption className="shop-scale__caption">{scale.caption}</figcaption>
    </figure>
  );
}
