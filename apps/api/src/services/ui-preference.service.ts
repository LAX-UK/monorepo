import type { UiPreferencePatch } from "@auction/validators";
import type { IUiPreferenceRepository, UiPreferenceRow } from "./interfaces/ui-preference.js";

const DEFAULT_THEME = "system" as const;
const DEFAULT_VIEW = "auto" as const;
const DEFAULT_DENSITY = "comfortable" as const;

export type UiPreferenceProjection = {
  theme: UiPreferenceRow["theme"];
  viewLotsDefault: UiPreferenceRow["viewLotsDefault"];
  viewArtistsDefault: UiPreferenceRow["viewArtistsDefault"];
  viewSalesDefault: UiPreferenceRow["viewSalesDefault"];
  density: UiPreferenceRow["density"];
  viewSync: boolean;
};

function rowToProjection(row: UiPreferenceRow | null): UiPreferenceProjection {
  return {
    theme: row?.theme ?? DEFAULT_THEME,
    viewLotsDefault: row?.viewLotsDefault ?? DEFAULT_VIEW,
    viewArtistsDefault: row?.viewArtistsDefault ?? DEFAULT_VIEW,
    viewSalesDefault: row?.viewSalesDefault ?? DEFAULT_VIEW,
    density: row?.density ?? DEFAULT_DENSITY,
    viewSync: row?.viewSync ?? false,
  };
}

export class UiPreferenceService {
  constructor(private readonly repo: IUiPreferenceRepository) {}

  async getForUser(userId: string): Promise<UiPreferenceProjection> {
    const row = await this.repo.getForUser(userId);
    return rowToProjection(row);
  }

  async patch(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow> {
    return this.repo.upsert(userId, patch);
  }

  async resetLayoutDefaults(userId: string): Promise<UiPreferenceRow> {
    return this.repo.resetLayoutDefaults(userId);
  }
}
