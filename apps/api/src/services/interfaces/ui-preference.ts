import type { ThemePreference, UiPreferencePatch } from "@auction/validators";

export type UiPreferenceRow = {
  userId: string;
  theme: ThemePreference;
  createdAt: Date;
  updatedAt: Date;
};

export interface IUiPreferenceRepository {
  getForUser(userId: string): Promise<UiPreferenceRow | null>;
  upsert(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow>;
}
