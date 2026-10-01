import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ShopAuthLinkProps = Omit<ComponentProps<typeof Link>, "prefetch"> & {
  href: string;
  children: ReactNode;
};

/** Auth-start routes must not use Next.js prefetch (GET side effects on shop-identity). */
export function ShopAuthLink({ href, children, className, ...rest }: ShopAuthLinkProps) {
  if (isShopAuthHref(href)) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={false} className={className} {...rest}>
      {children}
    </Link>
  );
}
