import { ShopAuthLink } from "@/components/shop-auth-link";
import { ShopNotice, type ShopNoticeTone } from "@/components/shop-notice";
import { type ShopBreadcrumbItem, ShopPageHeader } from "@/components/shop-page-header";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingArrowUpRightIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

export type ShopAccountNoticeVariant = "default" | "destructive" | "warning";

export type ShopAccountShellProps = {
  title: string;
  breadcrumbs?: readonly ShopBreadcrumbItem[];
  children: ReactNode;
  /** Hidden on pages that are not about the signed-in person, such as the disabled notice. */
  showAccountSettings?: boolean;
  notice?: {
    variant: ShopAccountNoticeVariant;
    title: string;
    description: ReactNode;
  };
};

const noticeTone: Record<ShopAccountNoticeVariant, ShopNoticeTone> = {
  default: "info",
  destructive: "error",
  warning: "warning",
};

/** Full-width account page: breadcrumbs and title, then the hand-off to LAX Account settings. */
export function ShopAccountShell({
  title,
  breadcrumbs,
  children,
  showAccountSettings = true,
  notice,
}: ShopAccountShellProps) {
  const trail = breadcrumbs ?? [{ label: "Shop", href: "/" }, { label: title }];

  return (
    <main
      id="main-content"
      className={cn(MARKETING_CATALOG_PT, "bg-page-bg pb-[var(--page-bottom-padding,3rem)]")}
    >
      <div className={cn(MARKETING_PAGE_SHELL, "shop-page py-8 lg:py-12")}>
        <div className="shop-account">
          <div className="shop-account__header">
            <ShopPageHeader title={title} breadcrumbs={trail} />
            {showAccountSettings ? (
              <Button asChild variant="secondaryOutline" className="shop-account__settings">
                <a href={laxAccountUrl()}>
                  LAX Account settings
                  <MarketingArrowUpRightIcon aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>
          {notice ? (
            <ShopNotice tone={noticeTone[notice.variant]} title={notice.title}>
              <div className="text-on-surface-variant">{notice.description}</div>
            </ShopNotice>
          ) : null}
          <div className="shop-account__body">{children}</div>
        </div>
      </div>
    </main>
  );
}

export type ShopAccountLinkButtonProps = {
  href: string;
  label: string;
  variant?: "default" | "outline" | "secondaryOutline";
};

export function ShopAccountLinkButton({
  href,
  label,
  variant = "default",
}: ShopAccountLinkButtonProps) {
  return (
    <Button asChild variant={variant} className="min-h-11 w-full sm:w-auto">
      {isShopAuthHref(href) ? (
        <ShopAuthLink href={href}>{label}</ShopAuthLink>
      ) : (
        <Link href={href}>{label}</Link>
      )}
    </Button>
  );
}

export function ShopAccountBodyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-on-surface-variant">{children}</p>;
}
