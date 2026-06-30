"use client";

import { adminListNuqsBaseParsers, adminListNuqsOptions } from "@/lib/admin/admin-list-nuqs-base";
import { invitationStatusFilterOptions } from "@/lib/admin/invitations-list-query";
import { parseAsString, useQueryStates } from "nuqs";

const invitationStatusValues = invitationStatusFilterOptions.map((o) => o.value);

/** Typed URL state for the admin invitations list (shareable filters + pagination). */
export function useInvitationsListNuqs() {
  return useQueryStates(
    {
      ...adminListNuqsBaseParsers,
      status: parseAsString.withDefault(""),
    },
    adminListNuqsOptions,
  );
}

export { invitationStatusValues };
