import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import { DisplayHeading, cn } from "@auction/ui";
import type { ReactNode } from "react";

type HeroShared = {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleAs?: "h1" | "h2";
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export type MarketingPageHeroDefaultProps = HeroShared & {
  variant?: "default" | undefined;
  /** Uses display token scale when `title` is a string. */
  titleSize?: "lg" | "md" | "sm" | "section";
  description?: ReactNode;
  breadcrumb?: ReactNode;
  media?: ReactNode;
};

export type MarketingPageHeroImmersiveProps = HeroShared & {
  variant: "immersive";
  /** Full-bleed background (e.g. cover image + scrims). */
  backdrop: ReactNode;
  /** Optional top-right toolbar (share, print). */
  toolbar?: ReactNode;
  /** Stats block (e.g. `<dl>…</dl>`). */
  stats?: ReactNode;
};

export type MarketingPageHeroProps =
  | MarketingPageHeroDefaultProps
  | MarketingPageHeroImmersiveProps;

function isImmersive(p: MarketingPageHeroProps): p is MarketingPageHeroImmersiveProps {
  return p.variant === "immersive";
}

export function MarketingPageHero(props: MarketingPageHeroProps) {
  if (isImmersive(props)) {
    const {
      backdrop,
      eyebrow,
      title,
      titleAs = "h1",
      meta,
      actions,
      stats,
      toolbar,
      className,
    } = props;

    const titleNode =
      typeof title === "string" ? (
        <DisplayHeading
          as={titleAs}
          size="lg"
          className="font-semibold text-white md:text-5xl md:leading-tight"
        >
          {title}
        </DisplayHeading>
      ) : (
        title
      );

    return (
      <header
        className={cn(
          "relative min-h-[min(60vh,520px)] w-full overflow-hidden bg-brand-900",
          className,
        )}
      >
        {backdrop}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(5,5,5,.85) 0%, rgba(5,5,5,.5) 55%, transparent 100%)",
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto flex min-h-[min(60vh,520px)] max-w-[var(--container-max,1440px)] flex-col px-8 pb-12 pt-[calc(var(--header-height)+2rem)] md:px-10 md:pb-14 lg:px-14">
          <div className="mt-auto max-w-[760px]">
            {eyebrow ? (
              <div className="fade-up mb-4 flex flex-wrap items-center gap-2 font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.22em] text-white/55">
                {eyebrow}
              </div>
            ) : null}
            <div className="mb-4">{titleNode}</div>
            {meta ? (
              <div className="fade-up-d2 mb-7 flex flex-wrap gap-x-5 gap-y-2 font-body text-sm text-white/60">
                {meta}
              </div>
            ) : null}
            {actions ? <div className="fade-up-d3 flex flex-wrap gap-3">{actions}</div> : null}
            {stats ? <div className="fade-up-d4 mt-7">{stats}</div> : null}
          </div>
          {toolbar ? (
            <div className="mt-8 flex w-full justify-start lg:absolute lg:right-12 lg:top-[calc(var(--header-height)+2rem)] lg:mt-0 lg:w-auto">
              {toolbar}
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  const {
    breadcrumb,
    eyebrow,
    title,
    titleAs = "h1",
    titleSize = "md",
    description,
    meta,
    actions,
    media,
    className,
  } = props;

  const titleNode =
    typeof title === "string" ? (
      <DisplayHeading as={titleAs} size={titleSize}>
        {title}
      </DisplayHeading>
    ) : (
      title
    );

  return (
    <header className={cn(MARKETING_PAGE_INNER, "flex flex-col gap-4 py-8 md:py-10", className)}>
      {breadcrumb ? <div className="text-sm text-on-surface-variant">{breadcrumb}</div> : null}
      {eyebrow ? (
        <div className="text-[length:var(--text-label-3)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
          {eyebrow}
        </div>
      ) : null}
      <div className={cn("grid gap-6", media && "lg:grid-cols-[1fr_minmax(0,1fr)] lg:items-end")}>
        <div className="flex min-w-0 flex-col gap-3">
          {titleNode}
          {description ? (
            <div className="max-w-2xl font-body text-base text-on-surface-variant md:text-lg">
              {description}
            </div>
          ) : null}
          {meta ? <div className="text-sm text-on-surface-variant">{meta}</div> : null}
          {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
        </div>
        {media ? <div className="min-w-0">{media}</div> : null}
      </div>
    </header>
  );
}
