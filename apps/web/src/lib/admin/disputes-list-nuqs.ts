"use client";

import { adminListNuqsBaseParsers, adminListNuqsOptions } from "@/lib/admin/admin-list-nuqs-base";
import { parseAsString, useQueryStates } from "nuqs";

const disputeStatusValues = ["open", "under_review", "closed"] as const;

/** Typed URL state for the admin disputes list (shareable filters + pagination). */
export function useDisputesListNuqs() {
  return useQueryStates(
    {
      ...adminListNuqsBaseParsers,
      status: parseAsString.withDefault(""),
    },
    adminListNuqsOptions,
  );
}

export { disputeStatusValues };
