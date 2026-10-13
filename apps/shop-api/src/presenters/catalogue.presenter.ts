import type {
  PublicArtistDetail,
  PublicArtistList,
  PublicArtistSummary,
  PublicArtworkDetail,
  PublicArtworkList,
  PublicArtworkSummary,
  PublicCategoryList,
  PublicCategorySummary,
} from "@auction/shop-contracts";
import { encodeArtworkListCursor } from "../application/artwork-catalogue-cursor.js";
import { encodeCatalogueCursor, encodeSortLabelCursor } from "../application/catalogue-cursor.js";
import type { ListPublicArtistsResult } from "../application/ports/artist-directory.reader.js";
import type { ListPublicArtworksResult } from "../application/ports/artwork-catalogue.reader.js";
import type { ListPublicCategoriesResult } from "../application/ports/category-catalogue.reader.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
  ArtworkDetailReadModel,
  ArtworkSummaryReadModel,
  CategorySummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export function presentArtworkSummary(model: ArtworkSummaryReadModel): PublicArtworkSummary {
  return {
    slug: model.slug,
    title: model.title,
    artistName: model.artistName,
    artistSlug: model.artistSlug,
    imageUrl: model.imageUrl,
    saleState: model.saleState,
    dimensions: model.dimensions,
    dimensionsCmDisplay: model.dimensionsCmDisplay,
    medium: model.medium,
    yearCreated: model.yearCreated,
    objectType: model.objectType,
    rarity: model.rarity,
    salesChannel: model.salesChannel,
    eligibleForEditionAllocation: model.eligibleForEditionAllocation,
    printPricePence: model.printPricePence,
    availability: { ...model.availability },
    updatedAt: model.updatedAt,
  };
}

export function presentArtworkDetail(model: ArtworkDetailReadModel): PublicArtworkDetail {
  return {
    ...presentArtworkSummary(model),
    description: model.description,
    images: model.images.map((image) => ({ ...image })),
    heightCm: model.heightCm,
    widthCm: model.widthCm,
    depthCm: model.depthCm,
    hasCertificate: model.hasCertificate,
    provenance: model.provenance,
    exhibitionHistory: model.exhibitionHistory,
    seoTitle: model.seoTitle,
    seoDescription: model.seoDescription,
  };
}

export function presentArtworkList(result: ListPublicArtworksResult): PublicArtworkList {
  return {
    items: result.items.map(presentArtworkSummary),
    ...(result.nextCursor ? { nextCursor: encodeArtworkListCursor(result.nextCursor) } : {}),
    ...(result.totalCount !== undefined ? { totalCount: result.totalCount } : {}),
  };
}

export function presentArtistSummary(model: ArtistSummaryReadModel): PublicArtistSummary {
  return {
    slug: model.slug,
    name: model.name,
    discipline: model.discipline,
    portraitUrl: model.portraitUrl,
    artworkCount: model.artworkCount,
  };
}

export function presentArtistDetail(model: ArtistDetailReadModel): PublicArtistDetail {
  return {
    ...presentArtistSummary(model),
    bio: model.bio,
    shortBio: model.shortBio,
    heroUrl: model.heroUrl,
    nationality: model.nationality,
    birthYear: model.birthYear,
    deathYear: model.deathYear,
    seoTitle: model.seoTitle,
    seoDescription: model.seoDescription,
  };
}

export function presentArtistList(result: ListPublicArtistsResult): PublicArtistList {
  return {
    items: result.items.map(presentArtistSummary),
    ...(result.nextCursor ? { nextCursor: encodeCatalogueCursor(result.nextCursor) } : {}),
  };
}

export function presentCategorySummary(model: CategorySummaryReadModel): PublicCategorySummary {
  return {
    slug: model.slug,
    label: model.label,
    imageUrl: model.imageUrl,
    artworkCount: model.artworkCount,
  };
}

export function presentCategoryList(result: ListPublicCategoriesResult): PublicCategoryList {
  return {
    items: result.items.map(presentCategorySummary),
    ...(result.nextCursor ? { nextCursor: encodeSortLabelCursor(result.nextCursor) } : {}),
  };
}
