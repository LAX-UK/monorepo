import { SITE_NAME } from "@/lib/brand";
import { LegalDocument, LegalHeading, type LegalHeadingProps } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { TocNavItem } from "@auction/ui";
import type { HTMLAttributes, ReactNode } from "react";

type Props = {
  title: string;
  /** Visible breadcrumb trail rendered above the eyebrow and title. */
  breadcrumb?: ReactNode;
  /** Line above the title. Defaults to the site name; `null` omits it. */
  kicker?: ReactNode | null;
  /** "On this page" entries; every id must exist in `children`. */
  toc?: readonly TocNavItem[];
  /** Display date, for example "17 June 2026". */
  lastUpdated?: string;
  /** Kept for existing callers: the shared header always rules off the title block. */
  dividerUnderDate?: boolean;
  /** Inside `PolicyHubLayout`, which supplies `<div>` and the page gutters. */
  embedded?: boolean;
  children: ReactNode;
};

/** Bid's policy and information pages, on the reading layout shared by every LAX product. */
export function LegalPage({
  title,
  breadcrumb,
  kicker,
  toc,
  lastUpdated,
  embedded,
  children,
}: Props) {
  const document = (
    <LegalDocument
      title={title}
      breadcrumb={breadcrumb}
      eyebrow={kicker === undefined ? SITE_NAME : kicker}
      {...(lastUpdated ? { lastUpdated: { label: lastUpdated } } : {})}
      {...(toc ? { toc: toc.map((item) => ({ id: item.id, label: item.label })) } : {})}
    >
      {children}
    </LegalDocument>
  );

  if (embedded) return document;

  return <div className="lax-legal-hub pt-[calc(var(--header-height)+1.5rem)]">{document}</div>;
}

/** Section heading for policy copy; with an `id` it carries a "#" link to itself. */
export function LegalH2({ className, ...rest }: LegalHeadingProps) {
  return <LegalHeading className={className} {...rest} />;
}

/** Bulleted list for policy copy, also used outside `LegalPage` (sell journey, FAQ). */
export function LegalUL({ className, children, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn("list-disc space-y-2 pl-5 marker:text-on-surface-variant", className)}
      {...rest}
    >
      {children}
    </ul>
  );
}
