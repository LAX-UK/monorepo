import type { EmailAlertState } from "@auction/types";

/** Where a person's alert emails stand. The alert engine supplies the real reader. */
export interface IAlertSubscriptionReader {
  stateFor(userId: string): Promise<EmailAlertState>;
}

/** Stands in until alerts exist: there is nothing to report. */
export class NoAlertSubscriptionReader implements IAlertSubscriptionReader {
  async stateFor(): Promise<EmailAlertState> {
    return null;
  }
}
