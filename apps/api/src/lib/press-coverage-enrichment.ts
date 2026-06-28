import type { SalePressRef } from "@auction/types";
import { fetchOpenGraphImage } from "./open-graph-image.js";

export type PressCoverageImageFetcher = (url: string) => Promise<string | null>;

export async function enrichPressCoverageWithOpenGraphImages(
  previous: SalePressRef[] | undefined,
  next: SalePressRef[],
  fetchImage: PressCoverageImageFetcher = fetchOpenGraphImage,
): Promise<SalePressRef[]> {
  const previousByUrl = new Map((previous ?? []).map((item) => [item.url, item]));

  return Promise.all(
    next.map(async (item) => {
      if (item.imageUrl) return item;

      const prev = previousByUrl.get(item.url);
      if (prev?.imageUrl) {
        return { ...item, imageUrl: prev.imageUrl };
      }

      const imageUrl = await fetchImage(item.url);
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  );
}
