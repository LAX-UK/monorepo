import type { HomeTrustVm } from "@/lib/home/home-trust";
import Link from "next/link";

/**
 * Four plain text columns under the first screen, divided by hairlines: delivery, collection,
 * changing your mind and a person to ask. Phones show one line in their place.
 */
export function HomeTrustStrip({ trust }: { trust: HomeTrustVm }) {
  return (
    <section className="shop-home-trust" aria-label="Buying from LAX Shop">
      <ul className="shop-home-trust__list">
        {trust.columns.map((column) => (
          <li key={column.id} className="shop-home-trust__item">
            <p className="shop-home-trust__title">{column.title}</p>
            {column.href ? (
              <a
                href={column.href}
                className="shop-home-trust__line shop-inline-link shop-focus-ring"
              >
                {column.line}
              </a>
            ) : (
              <p className="shop-home-trust__line">{column.line}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="shop-home-trust__phone">
        {trust.phone.text} ·{" "}
        <Link href={trust.phone.link.href} className="shop-inline-link shop-focus-ring">
          {trust.phone.link.label}
        </Link>
      </p>
    </section>
  );
}
