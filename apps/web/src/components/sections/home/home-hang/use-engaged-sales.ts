"use client";

import { fetchCoverViewer } from "@/lib/marketing-cover/cover-viewer.client";
import { useEffect, useState } from "react";

/**
 * The sales, among those given, that the signed-in person is registered or bidding in
 * (approved or pending). Read in the browser after the page has rendered, so the public page
 * stays the same for everyone; a failed read counts as not registered.
 */
export function useEngagedSales(
  saleIds: readonly string[],
  signedIn: boolean,
): ReadonlySet<string> {
  const [engaged, setEngaged] = useState<ReadonlySet<string>>(new Set());
  const key = saleIds.join(",");
  useEffect(() => {
    if (!signedIn || key === "") return;
    const controller = new AbortController();
    void Promise.all(
      key.split(",").map(async (id) => {
        const viewer = await fetchCoverViewer(id, controller.signal);
        return viewer === "approved" || viewer === "pending" ? id : null;
      }),
    ).then((ids) => {
      if (!controller.signal.aborted) setEngaged(new Set(ids.filter((id) => id !== null)));
    });
    return () => controller.abort();
  }, [key, signedIn]);
  return engaged;
}
