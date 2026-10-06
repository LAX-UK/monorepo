import { ShopAccountNav } from "@/components/account/shop-account-nav";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { ShopNotice, type ShopNoticeTone } from "@/components/shop-notice";
import type { ShopBreadcrumbItem } from "@/components/shop-page-header";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

export type ShopAccountNoticeVariant = "default" | "destructive" | "warning";

export type ShopAccountShellProps = {
  title: string;
  breadcrumbs?: readonly ShopBreadcrumbItem[];
  children: ReactNode;
  activeNavHref?: string;
  portalOwnershipEnabled?: boolean;
  payoutsEnabled?: boolean;
  /** When set, renders a shadcn Alert above the body copy. */
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

export function ShopAccountShell({
  title,
  breadcrumbs,
  children,
  notice,
  activeNavHref,
  portalOwnershipEnabled = false,
  payoutsEnabled = false,
}: ShopAccountShellProps) {
  const trail = breadcrumbs ?? [{ label: "Shop", href: "/" }, { label: "Account" }];
  const showNav = activeNavHref !== undefined;

  return (
    <main
      id="main-content"
      className={cn(MARKETING_CATALOG_PT, "bg-page-bg pb-[var(--page-bottom-padding,3rem)]")}
    >
      <div className={cn(MARKETING_PAGE_SHELL, "shop-page py-8 lg:py-12")}>
        <ShopCommercePageShell
          header={{ title, breadcrumbs: trail }}
          contentClassName="shop-account-route"
        >
          <div className="shop-panel flex w-full flex-col gap-4">
            {showNav ? (
              <ShopAccountNav
                activeHref={activeNavHref}
                portalOwnershipEnabled={portalOwnershipEnabled}
                payoutsEnabled={payoutsEnabled}
              />
            ) : null}
            {notice ? (
              <ShopNotice tone={noticeTone[notice.variant]} title={notice.title}>
                <div className="text-on-surface-variant">{notice.description}</div>
              </ShopNotice>
            ) : null}
            {children}
          </div>
        </ShopCommercePageShell>
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
    <Button asChild variant={variant} className="min-h-11 w-full">
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
