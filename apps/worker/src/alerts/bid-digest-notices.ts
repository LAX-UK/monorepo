import type { DigestNoticeInput, DigestNoticeWriter } from "@auction/alerts";
import type { IBidAlertLotNoticeWriter } from "@auction/persistence/interfaces";
import { lotNoticesOf } from "./lot-notices.js";

/**
 * Turns an assembled Bid digest into in-app notices for the signed-in person: one for followed
 * artists and one for saved searches, each grouping that day's lots. In a dry run the digest run
 * never calls this, so nobody is told in the app.
 */
export class BidDigestNotices implements DigestNoticeWriter {
  constructor(private readonly deps: { notices: Pick<IBidAlertLotNoticeWriter, "write"> }) {}

  async write(input: DigestNoticeInput): Promise<void> {
    const notices = lotNoticesOf(input.vm);
    if (notices.length === 0) return;
    await this.deps.notices.write({
      digestId: input.digestId,
      userId: input.subjectId,
      notices,
    });
  }
}
