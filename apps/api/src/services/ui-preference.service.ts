import type { UiPreferencePatch } from "@auction/validators";
import type { IUiPreferenceRepository, UiPreferenceRow } from "./interfaces/ui-preference.js";

const DEFAULT_THEME = "system" as const;

export class UiPreferenceService {
  constructor(private readonly repo: IUiPreferenceRepository) {}

  async getForUser(userId: string): Promise<{ theme: UiPreferenceRow["theme"] }> {
    const row = await this.repo.getForUser(userId);
    return { theme: row?.theme ?? DEFAULT_THEME };
  }

  async patch(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow> {
    return this.repo.upsert(userId, patch);
  }
}
