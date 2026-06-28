import type { SalePressMentionType } from "@auction/types";
import { cn } from "@auction/ui";
import type React from "react";
import { type SVGProps, useId } from "react";

type PlaceholderProps = SVGProps<SVGSVGElement> & {
  mentionType?: SalePressMentionType | null;
  label?: string;
  className?: string;
};

function Frame({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  const hatchId = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 320 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full text-brand-200 dark:text-brand-400", className)}
      aria-hidden
      {...props}
    >
      <title>Decorative illustration</title>
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
          patternTransform="rotate(45)"
          suppressHydrationWarning
        >
          <rect width="8" height="8" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="320" height="180" className="fill-surface-container-low" />
      <rect width="320" height="180" fill={`url(#${hatchId})`} suppressHydrationWarning />
      {children}
    </svg>
  );
}

/** Magazine cover — hero image area, bold headline bars, spotlight accent. */
function FeatureArt(props: SVGProps<SVGSVGElement>) {
  return (
    <Frame {...props}>
      {/* Magazine frame */}
      <rect
        x="80"
        y="28"
        width="160"
        height="124"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.45"
      />
      {/* Hero image area with subtle hatch fill */}
      <rect x="92" y="40" width="136" height="68" rx="2" fill="currentColor" opacity="0.12" />
      <rect
        x="92"
        y="40"
        width="136"
        height="68"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      {/* Spotlight corner accent */}
      <path d="M92 40 L128 40 L92 76 Z" fill="currentColor" opacity="0.25" />
      {/* Bold headline bars */}
      <path
        d="M92 118 H228 M92 132 H196 M92 142 H168"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </Frame>
  );
}

/** Two facing profile silhouettes with speech-bubble connector. */
function InterviewArt(props: SVGProps<SVGSVGElement>) {
  return (
    <Frame {...props}>
      {/* Left profile */}
      <circle cx="108" cy="78" r="22" stroke="currentColor" strokeWidth="2" opacity="0.45" />
      <path
        d="M88 108 C88 98 96 92 108 92 C120 92 128 98 128 108 L128 124 L108 118 L88 124 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.4"
      />
      {/* Right profile */}
      <circle cx="212" cy="78" r="22" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <path
        d="M192 108 C192 98 200 92 212 92 C224 92 232 98 232 108 L232 124 L212 118 L192 124 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* Speech connector */}
      <path
        d="M130 88 C148 72 172 72 190 88"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M148 88 L140 96 M172 88 L180 96"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Dialogue bubbles */}
      <rect
        x="132"
        y="62"
        width="56"
        height="28"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <path d="M148 90 V98" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Frame>
  );
}

/** Large serif-style quotation marks with attribution line. */
function QuoteArt(props: SVGProps<SVGSVGElement>) {
  return (
    <Frame {...props}>
      {/* Left curly quote — serif-inspired */}
      <path
        d="M108 68 C108 52 118 44 132 44 C120 56 116 68 116 82 H96 C96 72 100 62 108 68 Z"
        fill="currentColor"
        opacity="0.45"
      />
      {/* Right curly quote */}
      <path
        d="M188 68 C188 52 198 44 212 44 C200 56 196 68 196 82 H176 C176 72 180 62 188 68 Z"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Quote body lines */}
      <path
        d="M96 98 H224 M96 112 H200 M96 126 H168"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Attribution dash */}
      <path
        d="M128 142 H192"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="160" cy="142" r="2" fill="currentColor" opacity="0.45" />
    </Frame>
  );
}

/** Editorial grid collage — 2×2 thumbnail panels. */
function RoundupArt(props: SVGProps<SVGSVGElement>) {
  const panels = [
    { x: 72, y: 36, w: 68, h: 52, opacity: 0.35 },
    { x: 148, y: 36, w: 68, h: 52, opacity: 0.45 },
    { x: 72, y: 96, w: 68, h: 52, opacity: 0.4 },
    { x: 148, y: 96, w: 68, h: 52, opacity: 0.55 },
  ];

  return (
    <Frame {...props}>
      {panels.map((panel) => (
        <g key={`${panel.x}-${panel.y}`} opacity={panel.opacity}>
          <rect
            x={panel.x}
            y={panel.y}
            width={panel.w}
            height={panel.h}
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d={`M${panel.x + 12} ${panel.y + panel.h / 2} H${panel.x + panel.w - 12}`}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d={`M${panel.x + 12} ${panel.y + panel.h / 2 + 10} H${panel.x + panel.w - 24}`}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>
      ))}
      {/* Grid gutter accent */}
      <path d="M144 36 V148 M72 88 H216" stroke="currentColor" strokeWidth="1" opacity="0.2" />
    </Frame>
  );
}

/** Classic broadsheet — masthead bar, columns, image placeholder. */
function DefaultArt(props: SVGProps<SVGSVGElement>) {
  return (
    <Frame {...props}>
      {/* Page frame */}
      <rect
        x="72"
        y="32"
        width="176"
        height="116"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />
      {/* Masthead bar */}
      <rect x="72" y="32" width="176" height="16" fill="currentColor" opacity="0.2" />
      <path d="M72 48 H248" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path
        d="M88 40 H120"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Hero image placeholder */}
      <rect
        x="88"
        y="56"
        width="72"
        height="48"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <rect x="88" y="56" width="72" height="48" rx="2" fill="currentColor" opacity="0.08" />
      {/* Text columns */}
      <path
        d="M168 56 H232 M168 68 H228 M168 80 H220 M168 92 H232 M168 104 H216"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M88 112 H232 M88 124 H208 M88 136 H224"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.25"
      />
    </Frame>
  );
}

const ART_BY_TYPE: Record<
  SalePressMentionType,
  (props: SVGProps<SVGSVGElement>) => React.JSX.Element
> = {
  feature: FeatureArt,
  interview: InterviewArt,
  quote: QuoteArt,
  roundup: RoundupArt,
};

/** Decorative 16:9 placeholder keyed by press mention type. */
export function PressMentionTypePlaceholder({
  mentionType,
  label,
  className,
  ...props
}: PlaceholderProps) {
  const Art = mentionType ? (ART_BY_TYPE[mentionType] ?? DefaultArt) : DefaultArt;
  const normalizedLabel = label?.trim();

  return (
    <div
      role="img"
      aria-label={
        normalizedLabel
          ? `${normalizedLabel} press coverage placeholder`
          : "Press coverage placeholder"
      }
      className={cn("relative h-full w-full overflow-hidden bg-surface-container-low", className)}
    >
      <Art {...props} />
      {normalizedLabel ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface-container/90 to-transparent px-4 pb-3 pt-8 text-center font-label text-[10px] uppercase tracking-[0.12em] text-on-surface-variant/70">
          {normalizedLabel}
        </span>
      ) : null}
    </div>
  );
}
