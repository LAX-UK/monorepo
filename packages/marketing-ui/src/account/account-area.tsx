import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AccountAreaProps = {
  /** The account sub-navigation, for products with more than one account page. */
  subNav?: ReactNode;
  /** Notices about the account as a whole (an ended view-as session, a failed load). */
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Where signed-in account pages sit on a product's public site: under the public header, after
 * the optional account sub-navigation, in the site's page column. It owns the main landmark.
 */
export function AccountArea({ subNav, banner, children, className }: AccountAreaProps) {
  return (
    <>
      {subNav}
      <main
        id="main-content"
        className={cn(MARKETING_PAGE_SHELL, "pt-6 pb-16 md:pt-10 md:pb-22", className)}
      >
        {banner ? <div className="mb-6 flex flex-col gap-3">{banner}</div> : null}
        {children}
      </main>
    </>
  );
}
