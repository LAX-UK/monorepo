import Link from "next/link";
import type { ReactNode } from "react";

type ShopInterestOutlineLinkProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
};

export function ShopInterestOutlineLink({ href, children, icon }: ShopInterestOutlineLinkProps) {
  return (
    <Link href={href} className="shop-detail__interest-outline shop-focus-ring">
      {icon ? <span className="shop-detail__interest-outline-icon">{icon}</span> : null}
      {children}
    </Link>
  );
}
