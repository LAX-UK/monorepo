import { cn } from "../../lib/utils.js";

export type MediaPlaceholderProps = {
  /**
   * What the image would show, for assistive tech ("Lot artwork", "Auction cover"). One to three
   * characters are read as initials and set on the mat.
   */
  label?: string | undefined;
  /** The work's title. Its initials are set on the mat, and the title itself when there is room. */
  title?: string | undefined;
  tone?: "light" | "dark" | "auto" | undefined;
  /** Intrinsic aspect ratio, matching the mockup helper's [width, height]. */
  aspect?: readonly [number, number] | undefined;
  /** Fill the nearest relative parent. Defaults to true when no aspect is provided. */
  fill?: boolean | undefined;
  shape?: "rect" | "circle" | undefined;
  loading?: boolean | undefined;
  className?: string | undefined;
};

/**
 * A paper mat on the product's surface tokens: warm light from the top left and a soft settle at
 * the bottom right give it the tooth of paper. `dark` is the lightbox, always on black.
 */
const LIGHT_PAPER =
  "bg-[image:radial-gradient(120%_90%_at_18%_8%,rgb(242_241_223/0.55),transparent_60%),radial-gradient(100%_80%_at_92%_100%,rgb(0_0_0/0.05),transparent_65%)]";
const DARK_PAPER =
  "bg-[image:radial-gradient(120%_90%_at_18%_8%,rgb(255_255_255/0.05),transparent_60%),radial-gradient(100%_80%_at_92%_100%,rgb(0_0_0/0.3),transparent_65%)]";

const MAT_CLASS = {
  light: `bg-surface-container-low text-on-surface-variant ${LIGHT_PAPER}`,
  dark: `bg-neutral-900 text-neutral-300 ${DARK_PAPER}`,
  auto: `bg-surface-container-low text-on-surface-variant ${LIGHT_PAPER} dark:bg-[image:radial-gradient(120%_90%_at_18%_8%,rgb(255_255_255/0.05),transparent_60%),radial-gradient(100%_80%_at_92%_100%,rgb(0_0_0/0.3),transparent_65%)]`,
} as const;

const SKIP_WORDS = new Set(["a", "an", "the", "of", "and", "lot", "untitled"]);

/** "The Blue Hour, 2021" → "BH". Words that start with a digit or say nothing are skipped. */
export function placeholderInitials(text: string | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 3 && !/\s/.test(trimmed)) return trimmed.toUpperCase();
  const words = trimmed
    .split(/[\s,.:;()–—-]+/)
    .filter((w) => /^\p{L}/u.test(w) && !SKIP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function MediaPlaceholder({
  label,
  title,
  tone = "auto",
  aspect,
  fill,
  shape = "rect",
  loading = false,
  className,
}: MediaPlaceholderProps) {
  const shouldFill = fill ?? !aspect;
  const normalizedLabel = label?.trim();
  const normalizedTitle = title?.trim();
  const shortLabel =
    normalizedLabel && normalizedLabel.length <= 3 ? normalizedLabel.toUpperCase() : null;
  const initials = shortLabel ?? placeholderInitials(normalizedTitle);
  const spoken = normalizedLabel || normalizedTitle;
  const isCircle = shape === "circle";

  return (
    <div
      role="img"
      aria-label={spoken ? `${spoken} placeholder` : "Image placeholder"}
      data-media-placeholder=""
      className={cn(
        "@container overflow-hidden",
        shouldFill ? "absolute inset-0 h-full w-full" : "relative w-full",
        isCircle && "rounded-full",
        loading && "animate-pulse motion-reduce:animate-none",
        MAT_CLASS[tone],
        className,
      )}
      style={aspect ? { aspectRatio: `${aspect[0]} / ${aspect[1]}` } : undefined}
    >
      {isCircle ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[8%] border border-current opacity-25"
        />
      )}
      {initials ? (
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[12%] text-center"
        >
          <span
            className={cn(
              "font-headline font-medium leading-none tracking-[0.16em]",
              isCircle
                ? "text-[clamp(0.75rem,38cqi,1.5rem)]"
                : "text-[clamp(0.75rem,14cqi,2.25rem)]",
            )}
          >
            {initials}
          </span>
          {normalizedTitle && !isCircle && !shortLabel ? (
            <span className="hidden max-w-full truncate font-[family-name:var(--font-outfit,var(--font-body))] text-xs @[12rem]:block">
              {normalizedTitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
