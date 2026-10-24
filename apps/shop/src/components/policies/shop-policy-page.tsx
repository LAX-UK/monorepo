import { ShopPageHeader } from "@/components/shop-page-header";
import type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicySection } from "@/content/policies";
import type { ShopPolicyRelease } from "@/content/policies/shop-policy-status";
import { parseShopPolicyText } from "@/content/policies/shop-policy-text";
import { MarketingDetailShell } from "@auction/marketing-ui";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Long pages get a table of contents; short ones are read top to bottom. */
const TOC_MIN_SECTIONS = 4;

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

export function formatPolicyDate(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T12:00:00Z`));
}

function PolicyText({ text }: { text: string }) {
  return (
    <>
      {parseShopPolicyText(text).map((part, index) => {
        const key = `${part.kind}-${index}`;
        switch (part.kind) {
          case "text":
            return <Fragment key={key}>{part.value}</Fragment>;
          case "strong":
            return <strong key={key}>{part.value}</strong>;
          case "placeholder":
            return (
              <mark key={key} className="shop-policy__placeholder">
                [TO CONFIRM: {part.value}]
              </mark>
            );
          case "link":
            return part.href.startsWith("#") ? (
              <a key={key} href={part.href} className="shop-policy__link shop-focus-ring">
                {part.label}
              </a>
            ) : (
              <Link key={key} href={part.href} className="shop-policy__link shop-focus-ring">
                {part.label}
              </Link>
            );
        }
      })}
    </>
  );
}

function PolicyBlock({ block }: { block: ShopPolicyBlock }): ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <PolicyText text={block.text} />
        </p>
      );
    case "subheading":
      return <h3 className="shop-policy__subheading">{block.text}</h3>;
    case "list": {
      const items = block.items.map((item) => (
        <li key={item}>
          <PolicyText text={item} />
        </li>
      ));
      return block.ordered ? (
        <ol className="shop-policy__list shop-policy__list--ordered">{items}</ol>
      ) : (
        <ul className="shop-policy__list">{items}</ul>
      );
    }
    case "table":
      return (
        <div className="shop-policy__table-wrap">
          <table className="shop-policy__table">
            <caption className="sr-only">{block.caption}</caption>
            <thead>
              <tr>
                {block.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={cell} scope="row">
                        <PolicyText text={cell} />
                      </th>
                    ) : (
                      <td
                        key={`${row[0]}-${block.columns[index]}`}
                        data-label={block.columns[index]}
                      >
                        <PolicyText text={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "panel":
      return (
        <section className="shop-policy__panel" aria-label={block.title}>
          <p className="shop-policy__panel-title">{block.title}</p>
          {block.blocks.map((inner, index) => (
            <PolicyBlock key={`${inner.type}-${index}`} block={inner} />
          ))}
        </section>
      );
  }
}

function PolicySection({ section }: { section: ShopPolicySection }) {
  const headingId = `${section.id}-heading`;
  return (
    <section id={section.id} className="shop-policy__section" aria-labelledby={headingId}>
      <h2 id={headingId} className="shop-policy__heading">
        {section.heading}
        <a
          href={`#${section.id}`}
          className="shop-policy__anchor shop-focus-ring"
          aria-label={`Link to “${section.heading}”`}
        >
          #
        </a>
      </h2>
      {section.blocks.map((block, index) => (
        <PolicyBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </section>
  );
}

export type ShopPolicyPageProps = {
  document: ShopPolicyDocument;
  release: ShopPolicyRelease;
  /** True off production while the page awaits legal approval. */
  draft: boolean;
};

export function ShopPolicyPage({ document, release, draft }: ShopPolicyPageProps) {
  const showToc = document.sections.length >= TOC_MIN_SECTIONS;
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--policy">
      <article className="shop-policy" data-policy={document.slug}>
        <ShopPageHeader
          title={document.title}
          breadcrumbs={[{ label: "Shop", href: "/" }, { label: document.title }]}
        />
        {draft ? (
          <div className="shop-policy__draft" role="note" aria-label="Draft notice">
            <p className="shop-policy__draft-title">Draft for legal review — not yet approved</p>
            <p>
              Highlighted <mark className="shop-policy__placeholder">[TO CONFIRM]</mark> items still
              need to be filled in. This page is not shown on the live site until it is approved.
            </p>
          </div>
        ) : null}
        <p className="shop-policy__meta">
          Last updated{" "}
          <time dateTime={release.lastUpdated}>{formatPolicyDate(release.lastUpdated)}</time>
          <span aria-hidden="true"> · </span>
          Version {release.version}
        </p>
        <div
          className={
            showToc ? "shop-policy__layout shop-policy__layout--toc" : "shop-policy__layout"
          }
        >
          {showToc ? (
            <nav className="shop-policy__toc" aria-labelledby="shop-policy-toc-heading">
              <h2 id="shop-policy-toc-heading" className="shop-policy__toc-heading">
                On this page
              </h2>
              <ol>
                {document.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="shop-policy__toc-link shop-focus-ring">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="shop-policy__body">
            <p className="shop-policy__lead">
              <PolicyText text={document.summary} />
            </p>
            {document.sections.map((section) => (
              <PolicySection key={section.id} section={section} />
            ))}
          </div>
        </div>
      </article>
    </MarketingDetailShell>
  );
}
