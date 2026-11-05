import type { ArtworkScaleVm } from "@/lib/presenters/artwork-scale.presenter";
import { cn } from "@auction/ui";

/**
 * The artwork drawn to scale beside a 1.7 m figure. The drawing's units are centimetres, so the
 * work and the figure keep their real proportions to each other; the photograph fills the work's
 * outline without cropping.
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
  const { scene, artwork, figure } = scale;
  const floorY = scene.height;
  const centreX = figure.x + figure.width / 2;
  const headRadius = figure.height * 0.065;
  const shoulderY = figure.y + headRadius * 2.6;
  const hipY = figure.y + figure.height * 0.52;

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
        {/* The figure: head, body and legs as a simple outline, 1.7 m from head to floor. */}
        <g className="shop-scale__figure">
          <circle cx={centreX} cy={figure.y + headRadius} r={headRadius} />
          <path
            d={`M ${figure.x} ${shoulderY + 8} Q ${figure.x} ${shoulderY} ${figure.x + 10} ${shoulderY} L ${figure.x + figure.width - 10} ${shoulderY} Q ${figure.x + figure.width} ${shoulderY} ${figure.x + figure.width} ${shoulderY + 8} L ${figure.x + figure.width - 6} ${hipY} L ${figure.x + 6} ${hipY} Z`}
          />
          <line x1={centreX - 8} x2={centreX - 8} y1={hipY} y2={floorY} />
          <line x1={centreX + 8} x2={centreX + 8} y1={hipY} y2={floorY} />
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
