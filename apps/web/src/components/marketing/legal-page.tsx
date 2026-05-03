import { SITE_NAME } from "@/lib/brand";
import { cn } from "@auction/ui";
import type { TocNavItem } from "@auction/ui";
import { TocNav } from "@auction/ui";
import type { HTMLAttributes, ReactNode } from "react";

type Props = {
  title: string;
  /**
   * Eyebrow rendered above the title. Pass a string for the historical
   * styled <p>; pass any ReactNode to fully customise the slot; pass
   * `null` to omit it (mockup-minimal pages).
   */
  kicker?: ReactNode | null;
  /** Optional table of contents (anchor ids must exist in `children`) */
  toc?: readonly TocNavItem[];
  /** ISO date string or display text */
  lastUpdated?: string;
  /** When true, draw a soft divider beneath the lastUpdated line. */
  dividerUnderDate?: boolean;
  embedded?: boolean;
  children: ReactNode;
};

function renderKicker(kicker: Props["kicker"]): ReactNode {
  if (kicker === null) return null;
  if (kicker === undefined) {
    return (
      <p className="mb-3 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
        {SITE_NAME}
      </p>
    );
  }
  if (typeof kicker === "string") {
    return (
      <p className="mb-3 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
        {kicker}
      </p>
    );
  }
  return kicker;
}

export function LegalPage({
  title,
  kicker,
  toc,
  lastUpdated,
  dividerUnderDate,
  embedded,
  children,
}: Props) {
  const content = (
    <>
      {renderKicker(kicker)}
      <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
        {title}
      </h1>
      {lastUpdated ? (
        <p
          className={cn(
            "mb-8 font-footer-links text-xs text-on-surface-variant",
            dividerUnderDate && "border-b border-divider-soft pb-6",
          )}
        >
          Last updated: {lastUpdated}
        </p>
      ) : null}
      {toc && toc.length > 0 ? (
        <div className="mb-10 lg:float-right lg:mb-4 lg:ml-8 lg:w-56 lg:pl-2">
          <TocNav items={toc} sticky={false} />
        </div>
      ) : null}
      <div className="clear-both space-y-6 font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
        {children}
      </div>
    </>
  );

  if (embedded) {
    return <section className="legal-print max-w-3xl px-6 py-12 md:px-16">{content}</section>;
  }

  return (
    <main
      id="main-content"
      className="legal-print mx-auto max-w-3xl px-6 pb-24 pt-[var(--section-pt)] md:px-10 lg:pt-32"
    >
      {content}
    </main>
  );
}

/**
 * Mockup-aligned heading for legal/marketing copy. Smaller than the historical
 * `font-headline text-2xl` h2 so dense legal pages match the LAX HTML mocks.
 */
export function LegalH2({ className, children, id, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      id={id}
      className={cn(
        "mt-10 mb-3 font-headline font-medium text-on-surface text-[length:var(--text-legal-h2)] leading-snug tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
    </h2>
  );
}

/** Mockup-aligned unordered list for legal/marketing copy. */
export function LegalUL({ className, children, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        "list-disc space-y-2 pl-5 text-on-surface-variant marker:text-on-surface-variant",
        className,
      )}
      {...rest}
    >
      {children}
    </ul>
  );
}
