import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import type { ShopBreadcrumbItem } from "@/components/shop-page-header";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

export type ShopAccountNoticeVariant = "default" | "destructive" | "warning";

export type ShopAccountShellProps = {
  title: string;
  breadcrumbs?: readonly ShopBreadcrumbItem[];
  children: ReactNode;
  /** When set, renders a shadcn Alert above the body copy. */
  notice?: {
    variant: ShopAccountNoticeVariant;
    title: string;
    description: ReactNode;
  };
};

const noticeClass: Record<ShopAccountNoticeVariant, string> = {
  default: "border-outline-variant/30 bg-surface-container-low text-on-surface",
  destructive: "border-error/30 bg-error-container/10 text-on-surface ring-1 ring-error/15",
  warning: "border-lot-orange/40 bg-lot-orange/5 text-on-surface ring-1 ring-lot-orange/20",
};

export function ShopAccountShell({ title, breadcrumbs, children, notice }: ShopAccountShellProps) {
  const trail = breadcrumbs ?? [{ label: "Shop", href: "/" }, { label: "Account" }];

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
            {notice ? (
              <Alert className={cn(noticeClass[notice.variant])}>
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription className="text-on-surface-variant">
                  {notice.description}
                </AlertDescription>
              </Alert>
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
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function ShopAccountBodyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-on-surface-variant">{children}</p>;
}
