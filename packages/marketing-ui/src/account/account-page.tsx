import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AccountPageHeaderProps = {
  title: ReactNode;
  /** One line under the title saying what the page is for. */
  description?: ReactNode;
  /** The page's single action (a button or link); a page never offers more than one here. */
  action?: ReactNode;
  /** In-page views of the same list (Active / Won / Not won), under the title. */
  tabs?: ReactNode;
  /** A short line above the title, such as a back link on a detail page. */
  eyebrow?: ReactNode;
  className?: string | undefined;
};

/**
 * The head of a signed-in account page on a product's public site: a Montserrat title, one line
 * of description, at most one action and optional view tabs. Shared by every LAX product so the
 * same kind of page reads the same way everywhere; only the product accent differs.
 */
export function AccountPageHeader({
  title,
  description,
  action,
  tabs,
  eyebrow,
  className,
}: AccountPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-6 md:gap-7", className)}>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-4 font-body text-sm text-on-surface-variant">{eyebrow}</div>
          ) : null}
          <h1 className="text-balance font-headline text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.01em] text-on-surface md:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[60ch] font-body text-base leading-relaxed text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div data-account-page-action="" className="flex shrink-0 max-md:*:w-full">
            {action}
          </div>
        ) : null}
      </div>
      {tabs ? <div data-account-page-tabs="">{tabs}</div> : null}
    </div>
  );
}

export type AccountPageProps = AccountPageHeaderProps & {
  children: ReactNode;
  /** Classes for the content under the header. */
  contentClassName?: string;
};

/** A whole account page: the shared header, then the page's content. */
export function AccountPage({ children, contentClassName, ...header }: AccountPageProps) {
  return (
    <div className="flex flex-col gap-7">
      <AccountPageHeader {...header} />
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </div>
  );
}
