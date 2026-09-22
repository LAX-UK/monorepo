import { ShopCatalogueEmpty } from "@/components/catalogue/shop-catalogue-empty";
import { ShopCatalogueHub } from "@/components/catalogue/shop-catalogue-hub";
import { CategoryCard } from "@/components/home/cards/category-card";
import { buildCatalogueCategoryCards } from "@/lib/catalogue/catalogue-category-card.vm";
import { fetchPublicCategories } from "@/lib/shop-api.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories | LAX Shop",
  description: "Explore the LAX Shop catalogue by category.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesIndexPage() {
  const { items } = await fetchPublicCategories({ limit: 50 });
  const cards = buildCatalogueCategoryCards(items);

  return (
    <ShopCatalogueHub title="Categories" description="Explore the LAX Shop catalogue by category.">
      {items.length === 0 ? (
        <ShopCatalogueEmpty
          title="No categories yet"
          description="Curated collections will appear here as new artwork is published."
          actionHref="/artworks"
          actionLabel="Browse all artworks"
        />
      ) : (
        <ul className="shop-catalogue__list">
          {cards.map((card) => (
            <li key={card.id}>
              <CategoryCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </ShopCatalogueHub>
  );
}
