import type { ArtistKind } from "@auction/types";

export type ArtistListScenario = "maker-seller" | "historical" | "brand-entity";

export function artistListScenario(input: {
  ownerUserId: string | null | undefined;
  kind: ArtistKind | undefined;
}): ArtistListScenario {
  if (input.ownerUserId && input.ownerUserId.length > 0) return "maker-seller";
  if (input.kind === "brand" || input.kind === "marque") return "brand-entity";
  return "historical";
}

export function artistListScenarioLabel(scenario: ArtistListScenario): string {
  switch (scenario) {
    case "maker-seller":
      return "Maker–seller";
    case "brand-entity":
      return "Brand / marque";
    default:
      return "Historical / external";
  }
}
