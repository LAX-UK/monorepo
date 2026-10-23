import { MarketingViewAllChevron } from "@auction/marketing-ui";

export type CardLinkItem = { key: string; title: string; description?: string; href: string };

/** A headed grid of link cards; the overview's categories and launch links share this look. */
export function CardLinkSection({
  id,
  heading,
  items,
  footer,
}: {
  id: string;
  heading: string;
  items: CardLinkItem[];
  footer?: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="font-headline text-lg font-semibold">
        {heading}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              className="flex h-full min-h-11 items-center gap-3 rounded-2xl border border-border-hairline bg-surface p-4 transition-colors hover:bg-surface-container-high/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-on-surface">{item.title}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-on-surface-variant">
                    {item.description}
                  </span>
                ) : null}
              </span>
              <MarketingViewAllChevron className="text-on-surface-variant" />
            </a>
          </li>
        ))}
      </ul>
      {footer ? <p className="text-xs text-on-surface-variant">{footer}</p> : null}
    </section>
  );
}
