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
    imageUrl: model.imageUrl,
    saleState: model.saleState,
    dimensions: model.dimensions,
    yearCreated: model.yearCreated,
    eligibleForEditionAllocation: model.eligibleForEditionAllocation,
    printPricePence: model.printPricePence,
    availability: { ...model.availability },
  };
}

export function presentArtworkDetail(model: ArtworkDetailReadModel): PublicArtworkDetail {
  return {
    ...presentArtworkSummary(model),
    description: model.description,
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
