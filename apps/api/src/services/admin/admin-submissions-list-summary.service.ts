import type {
  AdminSubmissionsListSummary,
  IAdminSubmissionsSummaryReader,
} from "@auction/persistence/interfaces";

export type { AdminSubmissionsListSummary } from "@auction/persistence/interfaces";

export class AdminSubmissionsListSummaryService {
  constructor(private readonly reader: IAdminSubmissionsSummaryReader) {}

  getSummary(userId: string): Promise<AdminSubmissionsListSummary> {
    return this.reader.getSummaryForStaff(userId);
  }
}
