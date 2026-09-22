import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopCataloguePagerLink } from "@/components/catalogue/shop-catalogue-hub";
import { fetchPublicArtworks, fetchPublicCategoryBySlug } from "@/lib/shop-api.server";
import { FOCUS_RING } from "@auction/branding";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { DisplayHeading } from "@auction/ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export async function generateMetadata({ params }: CategoryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const category = await fetchPublicCategoryBySlug(slug);
    if (!category) {
      return {
        title: "Category not found | LAX Shop",
        robots: { index: false, follow: false },
      };
    }
    return {
      title: `${category.label} | LAX Shop`,
      description: `Explore ${category.label} artworks in the LAX Shop catalogue.`,
      alternates: { canonical: `/categories/${encodeURIComponent(slug)}` },
    };
  } catch {
    return {
      title: "Category | LAX Shop",
      robots: { index: false, follow: false },
    };
  }
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const category = await fetchPublicCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const artworks = await fetchPublicArtworks({
    limit: 24,
    categorySlug: slug,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  return (
    <MarketingDetailShell
      wayfinding={
        <Link
          href="/categories"
          className={cn("text-link underline-offset-4 hover:underline", FOCUS_RING)}
        >
          ← Back to categories
        </Link>
      }
      wayfindingClassName="pt-6"
      shellClassName="flex flex-col gap-8 py-4"
    >
      <DisplayHeading as="h1" size="md">
        {category.label}
      </DisplayHeading>
      <CatalogueGrid items={artworks.items} />
      {artworks.nextCursor ? (
        <ShopCataloguePagerLink
          href={{
            pathname: `/categories/${slug}`,
            query: { cursor: artworks.nextCursor },
          }}
        >
          Next artworks
        </ShopCataloguePagerLink>
      ) : null}
    </MarketingDetailShell>
  );
}
