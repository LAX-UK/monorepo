import {
  ArtworkMoneyPausedError,
  type MoneyPauseReader,
  assertMoneyNotPaused,
} from "@auction/artwork-register-contracts";
import type { ILotRegisterLinkReader } from "@auction/persistence/interfaces";
import { ReofferError } from "./reoffer-errors.js";
import type { IReofferMoneyPauseGuard, ReofferMoneyStep } from "./reoffer-ports.js";

/**
 * Refuses to send or accept a re-offer while Zoho says the lot's artwork is Sold or Reserved and
 * LAX still has it for sale. The refusal carries the shared staff wording. A lot with no register
 * record is not governed, as everywhere else the pause applies.
 */
export class RegisterMoneyPauseGuard implements IReofferMoneyPauseGuard {
  constructor(
    private readonly links: Pick<ILotRegisterLinkReader, "findLink">,
    private readonly pause: MoneyPauseReader,
  ) {}

  async assertNotPaused(
    step: ReofferMoneyStep,
    context: { lotId: string; reofferId: string },
  ): Promise<void> {
    const link = await this.links.findLink(context.lotId);
    try {
      await assertMoneyNotPaused(this.pause, link ? { registerId: link.registerId } : null, step);
    } catch (error) {
      if (error instanceof ArtworkMoneyPausedError) {
        throw new ReofferError("money_paused", error.message);
      }
      throw error;
    }
  }
}
