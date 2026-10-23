import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkRail } from "@/components/catalogue/art-artwork-rail";
import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { EditorialBodyVm, EditorialRailVm } from "@/lib/editorial/editorial-body.composer";
import {
  MarketingInfoStrip,
  MarketingPullQuote,
  MarketingReveal,
  MarketingVideoPoster,
} from "@auction/marketing-ui";
import {
  type EditorialBlock,
  type EditorialImageBlock,
  type EditorialInlineSpan,
  isSafeEditorialHref,
} from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";

type BlockOf<T extends EditorialBlock["type"]> = Extract<EditorialBlock, { type: T }>;

type RenderContext = { idPrefix: string; index: number; rail: EditorialRailVm | undefined };

const PROSE = "max-w-prose text-base leading-relaxed text-on-surface";
const INLINE_LINK = "text-link underline underline-offset-4 hover:no-underline art-focus-ring";

export function InlineSpans({ spans }: { spans: readonly EditorialInlineSpan[] }) {
  return spans.map((span, index) => {
    const marks = span.marks ?? [];
    let node: ReactNode = span.text;
    if (marks.includes("bold")) node = <strong className="font-semibold">{node}</strong>;
    if (marks.includes("italic")) node = <em>{node}</em>;
    if (marks.includes("link") && span.href) {
      node = (
        <ArtEditorialLink href={span.href} className={INLINE_LINK}>
          {node}
        </ArtEditorialLink>
      );
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: spans are positional and never reordered.
    return <span key={index}>{node}</span>;
  });
}

function Figure({
  image,
  sizes,
  aspect,
}: {
  image: EditorialImageBlock;
  sizes: string;
  aspect: "auto" | "square";
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div
        className={cn(
          "relative overflow-hidden bg-surface-container",
          aspect === "square" ? "aspect-square" : "aspect-[3/2]",
        )}
      >
        <ArtMediaImage
          src={image.mediaKey}
          alt={image.alt ?? ""}
          sizes={sizes}
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      </div>
      {image.caption ? (
        <figcaption className="text-sm text-on-surface-variant">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}

const HEADING_CLASS: Record<2 | 3 | 4, string> = {
  2: "font-headline text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl",
  3: "font-headline text-xl font-semibold text-on-surface",
  4: "font-headline text-lg font-semibold text-on-surface",
};

function RailSection({
  rail,
  id,
}: {
  rail: EditorialRailVm;
  id: string;
}) {
  const headline =
    rail.headline ?? (rail.kind === "artworks" ? "Featured works" : "Featured artists");
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2 id={`${id}-title`} className={HEADING_CLASS[3]}>
        {headline}
      </h2>
      {rail.kind === "artworks" ? (
        <ArtArtworkRail
          id={id}
          label={headline}
          cards={rail.cards}
          favoriteAuth={rail.favoriteAuth}
        />
      ) : (
        <ArtArtistGrid cards={rail.cards} favoriteAuth={rail.favoriteAuth} aria-label={headline} />
      )}
    </section>
  );
}

const RENDERERS: {
  [T in EditorialBlock["type"]]: (block: BlockOf<T>, ctx: RenderContext) => ReactNode;
} = {
  heading: (block) => {
    const Tag = `h${block.level}` as "h2" | "h3" | "h4";
    return <Tag className={HEADING_CLASS[block.level]}>{block.text}</Tag>;
  },
  richText: (block) => (
    <p className={PROSE}>
      <InlineSpans spans={block.spans} />
    </p>
  ),
  quote: (block) => (
    <MarketingPullQuote
      variant="accent"
      className="max-w-prose"
      {...(block.attribution ? { attribution: block.attribution } : {})}
    >
      {block.text}
    </MarketingPullQuote>
  ),
  image: (block) => <Figure image={block} sizes="(min-width: 64rem) 75rem, 100vw" aspect="auto" />,
  imagePair: (block) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Figure image={block.left} sizes="(min-width: 40rem) 24rem, 100vw" aspect="square" />
      <Figure image={block.right} sizes="(min-width: 40rem) 24rem, 100vw" aspect="square" />
    </div>
  ),
  gallery: (block) => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {block.items.map((image, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: gallery order is authored and stable.
        <Figure key={index} image={image} sizes="(min-width: 48rem) 16rem, 50vw" aspect="square" />
      ))}
    </div>
  ),
  video: (block) =>
    isSafeEditorialHref(block.url) && block.url.startsWith("https://") ? (
      <MarketingVideoPoster
        href={block.url}
        title={block.title ?? "Film"}
        {...(block.posterMediaKey
          ? {
              poster: (
                <ArtMediaImage
                  src={block.posterMediaKey}
                  alt=""
                  sizes="(min-width: 64rem) 48rem, 100vw"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              ),
            }
          : {})}
      />
    ) : null,
  faqGroup: (block) => (
    <Accordion type="multiple" className="max-w-prose border-t border-border-hairline">
      {block.items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: FAQ order is authored and stable.
        <AccordionItem key={index} value={`faq-${index}`} className="border-border-hairline">
          <AccordionTrigger className="min-h-11 font-headline text-base text-on-surface">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed text-on-surface-variant">
            <InlineSpans spans={item.answer} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
  cardGrid: (block) => (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {block.items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: card order is authored and stable.
        <li key={index}>
          <ArtEditorialLink
            href={item.linkUrl}
            className="art-focus-ring group flex h-full flex-col gap-3 rounded-sm"
          >
            {item.mediaKey ? (
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-container">
                <ArtMediaImage
                  src={item.mediaKey}
                  alt=""
                  sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              </div>
            ) : null}
            <span className="font-headline text-lg font-semibold text-on-surface group-hover:underline">
              {item.title}
            </span>
            {item.body ? (
              <span className="text-sm text-on-surface-variant">{item.body}</span>
            ) : null}
          </ArtEditorialLink>
        </li>
      ))}
    </ul>
  ),
  cta: (block) => (
    <aside className="flex flex-col items-start gap-4 rounded-md border border-border-hairline bg-surface-container-low p-6 sm:p-8">
      <p className={HEADING_CLASS[3]}>{block.title}</p>
      {block.body ? <p className="max-w-prose text-on-surface-variant">{block.body}</p> : null}
      {isSafeEditorialHref(block.href) ? (
        <Button asChild size="lg" className="min-h-11 font-label">
          <ArtEditorialLink href={block.href}>{block.buttonLabel}</ArtEditorialLink>
        </Button>
      ) : null}
    </aside>
  ),
  artworkRail: (_block, ctx) =>
    ctx.rail ? <RailSection rail={ctx.rail} id={`${ctx.idPrefix}-rail-${ctx.index}`} /> : null,
  artistRail: (_block, ctx) =>
    ctx.rail ? <RailSection rail={ctx.rail} id={`${ctx.idPrefix}-rail-${ctx.index}`} /> : null,
  infoStrip: (block) => (
    <MarketingInfoStrip
      dateLabel={block.dateLabel ?? null}
      venueLabel={block.venueLabel ?? null}
      hoursLabel={block.hoursLabel ?? null}
    />
  ),
};

function renderBlock(block: EditorialBlock, ctx: RenderContext): ReactNode {
  const render = RENDERERS[block.type] as (block: EditorialBlock, ctx: RenderContext) => ReactNode;
  return render(block, ctx);
}

type EditorialBlockRendererProps = {
  body: EditorialBodyVm;
  className?: string;
  /** Keeps rail element ids unique when a page renders more than one body. */
  idPrefix?: string;
  /** Lets image and gallery blocks break out of a narrow prose column on large screens (Figma `687:17324`). */
  wideMedia?: boolean;
};

// Centred on the viewport rather than the column, and capped below the viewport so the page never scrolls sideways.
const WIDE_MEDIA = "lg:relative lg:left-1/2 lg:w-[min(75rem,calc(100vw-5rem))] lg:-translate-x-1/2";

/** Typed block registry for CMS bodies; unknown or unresolvable blocks render nothing. */
export function EditorialBlockRenderer({
  body,
  className,
  idPrefix = "editorial",
  wideMedia = false,
}: EditorialBlockRendererProps) {
  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {body.blocks.map((block, index) => {
        const node = renderBlock(block, { idPrefix, index, rail: body.rails[index] });
        return node ? (
          <MarketingReveal key={`${block.type}-${index}`} index={index}>
            {wideMedia && (block.type === "image" || block.type === "gallery") ? (
              <div className={WIDE_MEDIA}>{node}</div>
            ) : (
              node
            )}
          </MarketingReveal>
        ) : null;
      })}
    </div>
  );
}
