import type { ArtistKind } from "@auction/types";
import type { ArtistScenario } from "./types";

export type ScenarioConfig = {
  id: ArtistScenario;
  label: string;
  subtitle: string;
  examples: string;
  defaultKind: ArtistKind;
};

export const SCENARIO_REGISTRY: Record<ArtistScenario, ScenarioConfig> = {
  historical: {
    id: "historical",
    label: "Historical or external profile",
    subtitle:
      "For deceased artists, famous creators, brands, or anyone not registered on the platform.",
    examples: "e.g. Picasso, Ferrari, Hermès",
    defaultKind: "artist",
  },
  "maker-seller": {
    id: "maker-seller",
    label: "Platform maker–seller",
    subtitle: "A registered user who sells work they made. Link their account for attribution.",
    examples: "When the seller is also the maker",
    defaultKind: "maker",
  },
};

export function scenarioFromOwnerUserId(ownerUserId: string | null | undefined): ArtistScenario {
  return ownerUserId && ownerUserId.length > 0 ? "maker-seller" : "historical";
}

export function parseScenarioParam(raw: string | undefined): ArtistScenario | null {
  if (raw === "historical" || raw === "maker-seller") return raw;
  return null;
}
