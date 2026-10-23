import { roleLabel } from "@/lib/organisations/legal-entity-labels";
import type { LegalEntitySummary } from "@auction/types";

type ActingEntity = Pick<LegalEntitySummary, "id" | "kind" | "displayName">;

/** The mode label in the shell header: "Selling", or "Selling as Northbank Gallery". */
export function sellingModeLabel(acting: ActingEntity | null): string {
  return acting?.kind === "organisation" ? `Selling as ${acting.displayName}` : "Selling";
}

/** One choice in the Selling mode picker: the person's own account or an organisation. */
export type SellingContextOption = {
  id: string;
  name: string;
  /** "Your own account", or the person's role in the organisation. */
  detail: string;
  kind: "personal" | "organisation";
  current: boolean;
};

/**
 * The accounts someone can sell as, personal first, then organisations in the order the API
 * returns them. Organisations are left out when the organisation module is off, so a stale
 * membership never offers a context the rest of the app refuses.
 */
export function sellingContextOptions(input: {
  memberships: readonly LegalEntitySummary[];
  actingId: string | null;
  orgModuleEnabled: boolean;
}): SellingContextOption[] {
  const { memberships, actingId, orgModuleEnabled } = input;
  const personal = memberships.find((m) => m.kind === "individual");
  const options: SellingContextOption[] = [];
  if (personal) {
    options.push({
      id: personal.id,
      name: "Personal",
      detail: "Your own account",
      kind: "personal",
      current: personal.id === actingId,
    });
  }
  if (orgModuleEnabled) {
    for (const m of memberships) {
      if (m.kind !== "organisation") continue;
      options.push({
        id: m.id,
        name: m.displayName,
        detail: roleLabel(m.role),
        kind: "organisation",
        current: m.id === actingId,
      });
    }
  }
  return options;
}
