import type { AtgSaleSettings } from "@auction/types";

export interface IAtgSaleSettingsWriter {
  /**
   * Saves staff ATG settings, creating the link row when missing. Returns false, writing nothing,
   * when the change is no longer allowed (the auction type once ATG has the auction; any change
   * once it is published or closed), so a concurrent worker step can't be overridden.
   */
  saveSettings(
    saleId: string,
    settings: AtgSaleSettings,
    actorUserId: string,
    at: Date,
  ): Promise<boolean>;
}
