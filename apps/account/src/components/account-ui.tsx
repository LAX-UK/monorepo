import type { SettingsGroupVm } from "@/server/domain/account-settings.vm";
import { MarketingCarouselPreviousIcon, MarketingViewAllChevron } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";
import { withProductNames } from "./product-name";

/**
 * The shared look of an Account page, so every page keeps one rhythm (an 8px scale):
 *  - sections sit 32px apart in the page column and a heading sits 16px above its content;
 *  - a card is a white surface with a hairline border and 16px radius, padded 16px on a phone
 *    and 24px from `sm`;
 *  - the page title is the only h1, section titles are h2 at `text-xl` and card titles `text-lg`.
 */
export const CARD = "rounded-2xl border border-border-hairline bg-surface";
export const CARD_PADDING = "p-4 sm:p-6";
/** Empty states match the cards: solid hairline border on the white surface, not a dashed grey box. */
export const EMPTY_STATE = "rounded-2xl border-solid border-border-hairline bg-surface";
export const SECTION_TITLE = "font-headline text-xl font-semibold text-on-surface";
export const CARD_TITLE = "font-headline text-lg font-semibold text-on-surface";
/**
 * Text fields and selects: 44px tall on the card surface, with an edge that clears 3:1 (the
 * shared field's 25% border is too faint to see on white or on the dark surface).
 */
export const FIELD = "h-11 border-control-border bg-surface";
/** Rows of a list card: 64px, whether a row holds two lines of text or a 44px button. */
export const LIST_ROW = "flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6";
/** A quiet tag beside a title ("This device"), matching the product tags. */
export const TAG =
  "inline-flex w-fit shrink-0 items-center rounded-full bg-surface px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap ring-1 ring-border-hairline ring-inset text-on-surface-variant";

/** "Back to <where>" above a page that sits below another page. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-sm px-1 text-sm font-medium text-on-surface-variant hover:text-on-surface"
    >
      <MarketingCarouselPreviousIcon aria-hidden className="size-4" />
      {label}
    </a>
  );
}

/**
 * Page title, with an optional line under it. Top-level pages are reached from the left menu so
 * they have no back link; a page below another (a work, deleting the account) names where back
 * goes.
 */
export function AccountPageHeader({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      {backHref ? <BackLink href={backHref} label={backLabel ?? "Back"} /> : null}
      <h1 className="font-headline text-3xl font-semibold tracking-tight break-words text-on-surface sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-prose text-base leading-7 text-on-surface-variant">
          {withProductNames(description)}
        </p>
      ) : null}
    </header>
  );
}

/** A page section: an h2, an optional line under it and the content, 16px apart. */
export function AccountSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** Small links beside the title, such as "Change". */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h2 id={`${id}-heading`} className={SECTION_TITLE}>
            {title}
          </h2>
          {actions}
        </div>
        {description ? (
          <p className="text-sm text-on-surface-variant">{withProductNames(description)}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A card of rows separated by hairlines. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn(CARD, "divide-y divide-border-hairline overflow-hidden", className)}>
      {children}
    </ul>
  );
}

/**
 * One row of a `ListCard`: a title and optional subtitle on the left, a value and trailing
 * content on the right, and a whole-row link when `href` is given.
 */
export function ListCardRow({
  title,
  subtitle,
  value,
  trailing,
  href,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1 basis-28">
        <span className="block text-sm font-medium text-on-surface">
          {withProductNames(title, "inherit")}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            {withProductNames(subtitle)}
          </span>
        ) : null}
      </span>
      {value ? (
        <span className="order-3 min-w-0 basis-full text-left text-sm [overflow-wrap:anywhere] text-on-surface-variant sm:order-2 sm:max-w-[60%] sm:basis-auto sm:text-right">
          {value}
        </span>
      ) : null}
      {trailing ? <span className="order-2 shrink-0 sm:order-3">{trailing}</span> : null}
    </>
  );
  const row = cn(LIST_ROW, "sm:flex-nowrap");
  return (
    <li>
      {href ? (
        <a href={href} className={cn(row, "transition-colors hover:bg-surface-container-low")}>
          {body}
          <MarketingViewAllChevron className="shrink-0 text-on-surface-variant" />
        </a>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

export function SettingsGroup({ group }: { group: SettingsGroupVm }) {
  return (
    <AccountSection id={`group-${group.id}`} title={group.label}>
      <ListCard>
        {group.rows.map((row) => (
          <ListCardRow
            key={row.href}
            title={row.title}
            {...(row.subtitle ? { subtitle: row.subtitle } : {})}
            href={row.href}
          />
        ))}
      </ListCard>
      {group.footer ? (
        <p className="text-xs text-on-surface-variant">{withProductNames(group.footer)}</p>
      ) : null}
    </AccountSection>
  );
}

/**
 * Title of a notice. The shared alert title is always an h5, which skips levels on these pages
 * and reads as plain text, so this states the level it sits at and gives it weight.
 */
export function NoticeTitle({
  level = 2,
  id,
  children,
}: {
  level?: 2 | 3;
  id?: string;
  children: string;
}) {
  return (
    <AlertTitle aria-level={level} className="font-semibold" {...(id ? { id } : {})}>
      {children}
    </AlertTitle>
  );
}
