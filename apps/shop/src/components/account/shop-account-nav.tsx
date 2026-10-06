import {
  type BuildShopAccountNavItemsInput,
  buildShopAccountNavItems,
} from "@/lib/account/account-nav.vm";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = BuildShopAccountNavItemsInput;

export function ShopAccountNav(props: Props) {
  const items = buildShopAccountNavItems(props);

  return (
    <nav aria-label="Account" className="shop-account-nav">
      <ul className="shop-account-nav__list">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn("shop-account-nav__link shop-focus-ring", item.active && "is-active")}
              {...(item.active ? { "aria-current": "page" as const } : {})}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
