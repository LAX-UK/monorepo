import { type LaxOperatedProduct, legalEntityFor, legalOperatorSentence } from "@auction/branding";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { LegalDocument, LegalNotice, LegalPlaceholder, LegalSection } from "../legal-document.js";
import { LegalEntityDetails } from "../legal-entity-details.js";
import { LegalHub, type LegalHubLink } from "../legal-hub.js";
import {
  type LegalPolicyBlock,
  type LegalPolicyDocument,
  type LegalPolicyRelease,
  type LegalPolicySection,
  type LegalPolicyText,
  parseLegalPolicyText,
} from "./policy-document.js";

/** Long pages get "On this page"; short ones are read top to bottom. */
const TOC_MIN_SECTIONS = 4;

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

export function formatLegalPolicyDate(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T12:00:00Z`));
}

function PolicyText({ text }: { text: LegalPolicyText }) {
  return (
    <>
      {parseLegalPolicyText(text).map((part, index) => {
        const key = `${part.kind}-${index}`;
        switch (part.kind) {
          case "text":
            return <Fragment key={key}>{part.value}</Fragment>;
          case "strong":
            return <strong key={key}>{part.value}</strong>;
          case "placeholder":
            return <LegalPlaceholder key={key}>[TO CONFIRM: {part.value}]</LegalPlaceholder>;
          case "link":
            return part.href.startsWith("/") ? (
              <Link key={key} href={part.href} className="lax-legal__link">
                {part.label}
              </Link>
            ) : (
              <a key={key} href={part.href} className="lax-legal__link">
                {part.label}
              </a>
            );
        }
      })}
    </>
  );
}

function PolicyBlock({ block }: { block: LegalPolicyBlock }): ReactNode {
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
      const items = block.items.map((item, index) => (
        <li key={`${index}-${item}`}>
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
              {block.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row[0]}`}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={`${rowIndex}-${cell}`} scope="row">
                        <PolicyText text={cell} />
                      </th>
                    ) : (
                      <td
                        key={`${rowIndex}-${block.columns[index]}`}
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
        <section className="lax-legal__panel" aria-label={block.title}>
          <p className="lax-legal__panel-title">{block.title}</p>
          {block.blocks.map((inner, index) => (
            <PolicyBlock key={`${inner.type}-${index}`} block={inner} />
          ))}
        </section>
      );
    case "company":
      return <LegalEntityDetails entities={[legalEntityFor(block.product)]} />;
  }
}

function PolicySection({ section }: { section: LegalPolicySection }) {
  return (
    <LegalSection id={section.id} heading={section.heading}>
      {section.blocks.map((block, index) => (
        <PolicyBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </LegalSection>
  );
}

export type LegalPolicyPageProps = {
  document: LegalPolicyDocument;
  release: LegalPolicyRelease;
  /** True off production while the page awaits legal review. */
  draft: boolean;
  /** Label of the policy list beside the page, such as "Shop policies". */
  hubLabel: string;
  /** Policy pages that may be linked on this deployment. */
  hubLinks: readonly LegalHubLink[];
  /** Ends the page with the registered details of the company that runs this product. */
  company?: LaxOperatedProduct;
};

const COMPANY_SECTION_ID = "company-details";

/**
 * A policy written in code (see `LegalPolicyDocument`) on the shared legal layout, with the
 * draft banner while it awaits legal review.
 */
export function LegalPolicyPage({
  document,
  release,
  draft,
  hubLabel,
  hubLinks,
  company,
}: LegalPolicyPageProps) {
  const toc =
    document.sections.length >= TOC_MIN_SECTIONS
      ? [
          ...document.sections.map((section) => ({ id: section.id, label: section.heading })),
          ...(company ? [{ id: COMPANY_SECTION_ID, label: "Company details" }] : []),
        ]
      : undefined;
  return (
    <LegalHub label={hubLabel} links={hubLinks}>
      <LegalDocument
        title={document.title}
        lastUpdated={{
          label: formatLegalPolicyDate(release.lastUpdated),
          iso: release.lastUpdated,
          ...(release.dateLabel ? { prefix: release.dateLabel } : {}),
        }}
        version={release.version}
        notice={
          draft ? (
            <LegalNotice title="Draft for legal review — not yet approved">
              <p>
                Highlighted <LegalPlaceholder>[TO CONFIRM]</LegalPlaceholder> items still need to be
                filled in. This page is not shown on the live site until it is approved.
              </p>
            </LegalNotice>
          ) : null
        }
        {...(document.lead ? { lead: <PolicyText text={document.lead} /> } : {})}
        {...(toc ? { toc } : {})}
      >
        {document.sections.map((section) => (
          <PolicySection key={section.id} section={section} />
        ))}
        {company ? (
          <LegalSection id={COMPANY_SECTION_ID} heading="Company details">
            <p>{legalOperatorSentence(company)}</p>
            <LegalEntityDetails entities={[legalEntityFor(company)]} />
          </LegalSection>
        ) : null}
      </LegalDocument>
    </LegalHub>
  );
}
