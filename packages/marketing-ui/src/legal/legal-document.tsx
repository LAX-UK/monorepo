import { cn } from "@auction/ui";
import type { HTMLAttributes, ReactNode } from "react";
import { LegalToc, type LegalTocItem } from "./legal-toc.js";

export type LegalLastUpdated = {
  /** Shown to the reader, for example "25 Oct 2026". */
  label: string;
  /** ISO date for `<time dateTime>`, when known. */
  iso?: string;
  /** Words before the date; defaults to "Last updated". */
  prefix?: string;
};

export type LegalDocumentProps = {
  title: string;
  /** Breadcrumb trail above the title. */
  breadcrumb?: ReactNode;
  /** Small line above the title. */
  eyebrow?: ReactNode;
  lastUpdated?: LegalLastUpdated;
  version?: string;
  /** Banner under the title, such as a draft notice. */
  notice?: ReactNode;
  /** Opening paragraph, set larger than the body. */
  lead?: ReactNode;
  /** Sections for "On this page"; every id must exist in `children`. */
  toc?: readonly LegalTocItem[];
  className?: string;
  children: ReactNode;
};

/**
 * One reading layout for every LAX policy, help and legal page: Montserrat title, Outfit body at
 * 17px in a 68-character column, "Last updated" and version, an optional notice, and "On this
 * page" beside the text (or above it on narrow screens). Each product supplies its own content.
 */
export function LegalDocument({
  title,
  breadcrumb,
  eyebrow,
  lastUpdated,
  version,
  notice,
  lead,
  toc,
  className,
  children,
}: LegalDocumentProps) {
  const hasToc = Boolean(toc && toc.length > 0);
  return (
    <article className={cn("lax-legal", hasToc && "lax-legal--toc", className)}>
      <header className="lax-legal__header">
        {breadcrumb ? <div className="lax-legal__breadcrumb">{breadcrumb}</div> : null}
        {eyebrow ? <p className="lax-legal__eyebrow">{eyebrow}</p> : null}
        <h1 className="lax-legal__title">{title}</h1>
        {lastUpdated || version ? (
          <p className="lax-legal__meta">
            {lastUpdated ? (
              <>
                {lastUpdated.prefix ?? "Last updated"}{" "}
                {lastUpdated.iso ? (
                  <time dateTime={lastUpdated.iso}>{lastUpdated.label}</time>
                ) : (
                  lastUpdated.label
                )}
              </>
            ) : null}
            {lastUpdated && version ? <span aria-hidden="true"> · </span> : null}
            {version ? <>Version {version}</> : null}
          </p>
        ) : null}
        {notice}
      </header>
      <div className="lax-legal__layout">
        {hasToc && toc ? <LegalToc items={toc} /> : null}
        <div className="lax-legal__body">
          {lead ? <p className="lax-legal__lead">{lead}</p> : null}
          {children}
        </div>
      </div>
    </article>
  );
}

export type LegalHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  id?: string;
  /** Fragment the "#" link points to; defaults to `id`. Without either there is no link. */
  anchor?: string;
};

/** Section heading with a visible "#" link to itself, for sharing a clause. */
export function LegalHeading({ id, anchor, className, children, ...rest }: LegalHeadingProps) {
  const target = anchor ?? id;
  const name = typeof children === "string" ? children : "this section";
  return (
    <h2 id={id} className={cn("lax-legal__heading", className)} {...rest}>
      <span>{children}</span>
      {target ? (
        <a href={`#${target}`} className="lax-legal__anchor" aria-label={`Link to ${name}`}>
          #
        </a>
      ) : null}
    </h2>
  );
}

export type LegalSectionProps = {
  id: string;
  heading: string;
  className?: string;
  children: ReactNode;
};

/** A titled section of a legal document, reachable at `#id`. */
export function LegalSection({ id, heading, className, children }: LegalSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("lax-legal__section", className)}>
      <LegalHeading id={headingId} anchor={id}>
        {heading}
      </LegalHeading>
      {children}
    </section>
  );
}

export type LegalNoticeProps = {
  title: string;
  children?: ReactNode;
  className?: string;
};

/** A boxed notice under the title, such as "Draft for legal review". */
export function LegalNotice({ title, children, className }: LegalNoticeProps) {
  return (
    <div className={cn("lax-legal__notice", className)} role="note" aria-label={title}>
      <p className="lax-legal__notice-title">{title}</p>
      {children}
    </div>
  );
}

/** Marks an unconfirmed detail, such as "[TO CONFIRM: company number]". */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return <mark className="lax-legal__placeholder">{children}</mark>;
}
