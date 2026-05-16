import type {
  DensityPreference,
  LayoutViewDefault,
  ThemePreference,
  UiPreferencePatch,
} from "@auction/validators";

export type UiPreferenceRow = {
  userId: string;
  theme: ThemePreference;
  viewLotsDefault: LayoutViewDefault;
  viewArtistsDefault: LayoutViewDefault;
  viewSalesDefault: LayoutViewDefault;
  density: DensityPreference;
  viewSync: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface IUiPreferenceRepository {
  getForUser(userId: string): Promise<UiPreferenceRow | null>;
  upsert(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow>;
  /** Sets lot/artist/sales view defaults to `auto` (per-screen cookies cleared separately on web). */
  resetLayoutDefaults(userId: string): Promise<UiPreferenceRow>;
}
