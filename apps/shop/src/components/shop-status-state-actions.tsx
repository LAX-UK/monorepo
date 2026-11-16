import { ShopAuthLink } from "@/components/shop-auth-link";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import { MarketingStatusAction } from "@auction/marketing-ui";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The actions inside a Shop status state, in their own module so a client error boundary can
 * use them without pulling in the state and its drawing set.
 */
type ShopStatusStateLinkProps = {
  href: string;
  children: ReactNode;
  priority?: "primary" | "secondary";
};

export function ShopStatusStateLink({
  href,
  children,
  priority = "secondary",
}: ShopStatusStateLinkProps) {
  const linkClass = "shop-focus-ring";
  return (
    <MarketingStatusAction priority={priority} asChild>
      {isShopAuthHref(href) ? (
        <ShopAuthLink href={href} className={linkClass}>
          {children}
        </ShopAuthLink>
      ) : (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      )}
    </MarketingStatusAction>
  );
}

export { MarketingStatusAction as ShopStatusStateAction };
