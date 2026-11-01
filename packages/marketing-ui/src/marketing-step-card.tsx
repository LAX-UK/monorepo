import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

type StepLinkProps = { href: string; className?: string; children: ReactNode };

export type MarketingStepCardProps = {
  /** 1-based position, shown before the title. */
  step: number;
  title: string;
  /** Prose for the step. */
  children?: ReactNode;
  /** Questions answered elsewhere, listed as links under the prose. */
  links?: readonly { label: string; href: string }[];
  /** Closing "need further help" line. */
  footer?: ReactNode;
  linkAs?: ComponentType<StepLinkProps>;
  "data-testid"?: string;
};

/** Bordered numbered step with prose, FAQ links and a help line (Figma how to buy `921:13111`). */
export function MarketingStepCard({
  step,
  title,
  children,
  links = [],
  footer,
  linkAs: LinkComponent = Link,
  "data-testid": testId,
}: MarketingStepCardProps) {
  return (
    <section
      className="flex flex-col gap-6 border border-outline-variant bg-surface p-6 md:p-8"
      data-testid={testId}
    >
      <h2 className="m-0 font-headline text-xl font-medium leading-snug text-on-surface md:text-2xl">
        {step}. {title}
      </h2>
      {children ? (
        <div className="flex max-w-prose flex-col gap-4 text-base leading-relaxed text-on-surface">
          {children}
        </div>
      ) : null}
      {links.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {links.map((link) => (
            <li key={link.label}>
              <LinkComponent
                href={link.href}
                className={cn(
                  "flex min-h-11 items-center rounded-sm text-base text-link hover:underline",
                  FOCUS_RING,
                )}
              >
                {link.label}
              </LinkComponent>
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? <p className="m-0 text-base text-on-surface">{footer}</p> : null}
    </section>
  );
}
