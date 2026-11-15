import "server-only";

import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/server-api-base";
import { NO_NAV_ACTIVITY, type NavActivity } from "@/lib/marketing/nav-activity";
import { cache } from "react";
import { z } from "zod";

const countBodySchema = z.object({ count: z.number() });
const listBodySchema = z.object({ data: z.array(z.unknown()) });

async function readJson(path: string): Promise<unknown> {
  const res = await catalogueFetch(
    `${getServerApiBase()}${path}`,
    CATALOGUE_FETCH_POLICIES.navActivity,
  );
  if (!res.ok) throw new Error(`Navigation activity request failed: ${res.status}`);
  return readJsonBody(res);
}

async function hasLiveSales(): Promise<boolean> {
  const body = listBodySchema.parse(await readJson("/sales?status=active&limit=1&offset=0"));
  return body.data.length > 0;
}

async function hasEndingSoon(): Promise<boolean> {
  const body = countBodySchema.parse(
    await readJson("/lots/count?status=active&endingWithinHours=24"),
  );
  return body.count > 0;
}

/**
 * Whether the live and ending-soon lists have anything in them. It is read with the page and
 * reused for a minute. A list that cannot be read counts as empty, so the menu never points at
 * a page that might be bare.
 */
export const loadNavActivity = cache(async (): Promise<NavActivity> => {
  const [liveSales, endingSoon] = await Promise.all([
    hasLiveSales().catch(() => NO_NAV_ACTIVITY.liveSales),
    hasEndingSoon().catch(() => NO_NAV_ACTIVITY.endingSoon),
  ]);
  return { liveSales, endingSoon };
});
