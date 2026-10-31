import { type QuietHours, isWithinQuietHours } from "@auction/domain";

/** SRP: quiet-hours window for push suppression, read in the person's own time zone. */
export interface IQuietHoursChecker {
  isQuietTime(quiet: QuietHours): boolean;
}

export class QuietHoursChecker implements IQuietHoursChecker {
  constructor(private readonly now: () => Date = () => new Date()) {}

  isQuietTime(quiet: QuietHours): boolean {
    return isWithinQuietHours(quiet, this.now());
  }
}
