import type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicySection } from "@/content/policies";
import type { ShopPolicyRelease } from "@/content/policies/shop-policy-status";
import { parseShopPolicyText } from "@/content/policies/shop-policy-text";
import { legalEntityFor } from "@auction/branding";
import {
  LegalDocument,
  LegalEntityDetails,
  LegalHub,
  type LegalHubLink,
  LegalNotice,
  LegalPlaceholder,
  LegalSection,
  MarketingDetailShell,
} from "@auction/marketing-ui";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Long pages get "On this page"; short ones are read top to bottom. */
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
            return <LegalPlaceholder key={key}>[TO CONFIRM: {part.value}]</LegalPlaceholder>;
          case "link":
            return part.href.startsWith("#") ? (
              <a key={key} href={part.href} className="lax-legal__link">
                {part.label}
              </a>
            ) : (
              <Link key={key} href={part.href} className="lax-legal__link">
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
      return <h3>{block.text}</h3>;
    case "list": {
      const items = block.items.map((item) => (
        <li key={item}>
          <PolicyText text={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "table":
      return (
        <div className="lax-legal__table-wrap">
          <table className="lax-legal__table">
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
    case "company":
      return <LegalEntityDetails entities={[legalEntityFor("shop")]} />;
    case "panel":
      return (
        <section className="lax-legal__panel" aria-label={block.title}>
          <p className="lax-legal__panel-title">{block.title}</p>
          {block.blocks.map((inner, index) => (
            <PolicyBlock key={`${inner.type}-${index}`} block={inner} />
          ))}
        </section>
      );
  }
}

function PolicySection({ section }: { section: ShopPolicySection }) {
  return (
    <LegalSection id={section.id} heading={section.heading}>
      {section.blocks.map((block, index) => (
        <PolicyBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </LegalSection>
  );
}

export type ShopPolicyPageProps = {
  document: ShopPolicyDocument;
  release: ShopPolicyRelease;
  /** True off production while the page awaits legal approval. */
  draft: boolean;
  /** Shop's policy pages that may be linked on this deployment, for the policy list. */
  hubLinks: readonly LegalHubLink[];
};

export function ShopPolicyPage({ document, release, draft, hubLinks }: ShopPolicyPageProps) {
  const toc =
    document.sections.length >= TOC_MIN_SECTIONS
      ? document.sections.map((section) => ({ id: section.id, label: section.heading }))
      : undefined;
  return (
    <MarketingDetailShell wrapChildren={false} data-policy={document.slug}>
      <LegalHub label="Shop policies" links={hubLinks}>
        <LegalDocument
          title={document.title}
          lastUpdated={{ label: formatPolicyDate(release.lastUpdated), iso: release.lastUpdated }}
          version={release.version}
          notice={
            draft ? (
              <LegalNotice title="Draft for legal review — not yet approved">
                <p>
                  Highlighted <LegalPlaceholder>[TO CONFIRM]</LegalPlaceholder> items still need to
                  be filled in. This page is not shown on the live site until it is approved.
                </p>
              </LegalNotice>
            ) : null
          }
          lead={<PolicyText text={document.summary} />}
          {...(toc ? { toc } : {})}
        >
          {document.sections.map((section) => (
            <PolicySection key={section.id} section={section} />
          ))}
        </LegalDocument>
      </LegalHub>
    </MarketingDetailShell>
  );
}
