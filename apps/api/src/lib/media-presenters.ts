import type { ItemSubmission, Lot, Sale } from "@auction/types";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";

export async function presentLotImages(
  resolver: MediaUrlResolver | undefined,
  row: Lot,
): Promise<Lot> {
  if (!resolver) return row;
  return { ...row, images: await resolver.resolveMany(row.images) };
}

export async function presentLotsImages(
  resolver: MediaUrlResolver | undefined,
  rows: Lot[],
): Promise<Lot[]> {
  if (!resolver) return rows;
  return Promise.all(rows.map((row) => presentLotImages(resolver, row)));
}

export async function presentSaleImages(
  resolver: MediaUrlResolver | undefined,
  row: Sale,
): Promise<Sale> {
  if (!resolver) return row;
  return { ...row, coverImages: await resolver.resolveMany(row.coverImages) };
}

/** Admin edit: keep raw storage keys and expose resolved URLs for thumbnails. */
export type SaleAdminImages = Sale & {
  coverImagePresentedUrls: string[];
};

export async function presentSaleAdminImages(
  resolver: MediaUrlResolver | undefined,
  row: Sale,
): Promise<SaleAdminImages> {
  const keys = row.coverImages;
  const coverImagePresentedUrls = resolver ? await resolver.resolveMany(keys) : keys.map((k) => k);
  return { ...row, coverImages: keys, coverImagePresentedUrls };
}

/** Admin edit: keep raw storage keys and expose resolved URLs for thumbnails. */
export type LotAdminImages = Lot & {
  imagePresentedUrls: string[];
};

export async function presentLotAdminImages(
  resolver: MediaUrlResolver | undefined,
  row: Lot,
): Promise<LotAdminImages> {
  const keys = row.images;
  const imagePresentedUrls = resolver ? await resolver.resolveMany(keys) : keys.map((k) => k);
  return { ...row, images: keys, imagePresentedUrls };
}

export async function presentSalesWithLotsImages(
  resolver: MediaUrlResolver | undefined,
  rows: { sale: Sale; lots: Lot[] }[],
): Promise<{ sale: Sale; lots: Lot[] }[]> {
  if (!resolver) return rows;
  return Promise.all(
    rows.map(async (row) => ({
      sale: await presentSaleImages(resolver, row.sale),
      lots: await presentLotsImages(resolver, row.lots),
    })),
  );
}

export async function presentSubmissionImages(
  resolver: MediaUrlResolver | undefined,
  row: ItemSubmission,
): Promise<ItemSubmission> {
  if (!resolver) return row;
  return { ...row, images: await resolver.resolveMany(row.images) };
}

export async function presentSubmissionsImages(
  resolver: MediaUrlResolver | undefined,
  rows: ItemSubmission[],
): Promise<ItemSubmission[]> {
  if (!resolver) return rows;
  return Promise.all(rows.map((row) => presentSubmissionImages(resolver, row)));
}
