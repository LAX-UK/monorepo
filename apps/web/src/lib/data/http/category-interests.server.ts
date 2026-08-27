import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type CategoryInterestState = {
  categoryIds: string[];
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
};

export async function getServerCategoryInterests(): Promise<CategoryInterestState> {
  const response = await authedServerFetch("/users/me/category-interests");
  await throwIfNotOk(response, "settings");
  const body = (await response.json()) as { data: CategoryInterestState };
  return body.data;
}

export async function replaceServerCategoryInterests(
  categoryIds: readonly string[],
): Promise<CategoryInterestState> {
  const response = await authedServerFetch("/users/me/category-interests", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ categoryIds }),
  });
  await throwIfNotOk(response, "settings");
  const body = (await response.json()) as { data: CategoryInterestState };
  return body.data;
}

export async function replaceServerCategoryInterestPreferences(
  categoryIds: readonly string[],
): Promise<CategoryInterestState> {
  const response = await authedServerFetch("/users/me/category-interests/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ categoryIds }),
  });
  await throwIfNotOk(response, "settings");
  const body = (await response.json()) as { data: CategoryInterestState };
  return body.data;
}
