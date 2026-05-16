import { cn } from "@auction/ui";
import { type ReactNode, useId } from "react";

export type MarketingPromoCtaProps = {
  /** Root element — use `div` when nested inside an outer `<section>`. */
  as?: "section" | "div";
  id?: string;
  /** Stable id for the `<h2>` (e.g. when the outer `<section>` uses `aria-labelledby`). */
  headingId?: string;
  /** Optional class on the title element (e.g. larger display on home consign). */
  titleClassName?: string;
  /** Small kicker above the title (e.g. newsletter list name). */
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Rich body between description and actions (forms, legal copy). */
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Editorial promo / consignment callout block for marketing rails. */
export function MarketingPromoCta({
  as: Root = "section",
  id,
  headingId,
  titleClassName,
  eyebrow,
  title,
  description,
  children,
  actions,
  className,
}: MarketingPromoCtaProps) {
  const autoId = useId();
  const titleId = headingId ?? (id ? `${id}-heading` : `promo-cta-title-${autoId}`);
  const sectionLabelledBy = Root === "section" ? { "aria-labelledby": titleId } : {};
  return (
    <Root
      id={id}
      {...sectionLabelledBy}
      className={cn(
        "rounded-2xl border border-outline-variant/20 bg-surface-container-low/60 p-8 md:p-10",
        className,
      )}
    >
      {eyebrow ? <div className="mb-2 text-on-surface-variant">{eyebrow}</div> : null}
      <h2 id={titleId} className={cn("font-headline text-2xl text-on-surface", titleClassName)}>
        {title}
      </h2>
      {description ? (
        <div className="mt-3 font-body text-on-surface-variant">{description}</div>
      ) : null}
      {children ? <div className="mt-6 w-full">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
    </Root>
  );
}
