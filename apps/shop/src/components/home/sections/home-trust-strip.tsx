import type { HomeTrustItemVm } from "@/lib/home/home-page.vm";
import {
  MarketingCertificateIcon,
  type MarketingIconProps,
  MarketingMapPinIcon,
  MarketingReturnIcon,
  MarketingTruckIcon,
} from "@auction/marketing-ui";
import Link from "next/link";
import type { ComponentType } from "react";

const TRUST_ICONS: Record<HomeTrustItemVm["id"], ComponentType<MarketingIconProps>> = {
  editions: MarketingCertificateIcon,
  gallery: MarketingMapPinIcon,
  delivery: MarketingTruckIcon,
  returns: MarketingReturnIcon,
};

/** Four plain promises right under the first screen, each linked to its detail where one exists. */
export function HomeTrustStrip({ items }: { items: readonly HomeTrustItemVm[] }) {
  return (
    <section className="shop-home-trust" aria-label="Buying from LAX Shop">
      <ul className="shop-home-trust__list">
        {items.map((item) => {
          const Icon = TRUST_ICONS[item.id];
          return (
            <li key={item.id} className="shop-home-trust__item">
              <Icon className="shop-home-trust__icon" />
              <div className="shop-home-trust__text">
                <p className="shop-home-trust__title">{item.title}</p>
                <p className="shop-home-trust__body">{item.body}</p>
                {item.link ? (
                  <Link href={item.link.href} className="shop-inline-link shop-focus-ring">
                    {item.link.label}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
