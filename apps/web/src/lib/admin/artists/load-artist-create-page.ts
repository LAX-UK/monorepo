import "server-only";

import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { CategoryNode } from "@auction/types";

export type ArtistScenarioParam = "historical" | "maker-seller" | null;

export type ArtistCreatePageModel = {
  categories: CategoryNode[];
  ownerUserId: string | null;
  displayName: string;
  initialScenario: ArtistScenarioParam;
};

function parseScenarioParam(raw: string | undefined): ArtistScenarioParam {
  if (raw === "historical" || raw === "maker-seller") return raw;
  return null;
}

type LoadArtistCreatePageInput = {
  ownerUserId?: string;
  displayName?: string;
  scenario?: string;
};

/** Data/composition boundary for `/admin/artists/new`. */
export async function loadAdminArtistCreatePage(
  input: LoadArtistCreatePageInput = {},
): Promise<ArtistCreatePageModel> {
  const ownerFromUrl = input.ownerUserId?.trim() ?? "";
  const displayFromUrl = input.displayName?.trim() ?? "";
  const categories = await (async () => {
    try {
      return await (await getServerCategoryReader()).tree();
    } catch {
      return [];
    }
  })();

  return {
    categories,
    ownerUserId: ownerFromUrl.length > 0 ? ownerFromUrl : null,
    displayName: displayFromUrl,
    initialScenario: parseScenarioParam(input.scenario?.trim()),
  };
}
