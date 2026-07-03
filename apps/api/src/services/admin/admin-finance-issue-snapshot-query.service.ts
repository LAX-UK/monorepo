import type { IAdminFinanceIssueSnapshotReader } from "../../repositories/interfaces/admin-finance-issue-snapshot.reader.js";
import type {
  FinanceIssueSnapshot,
  IAdminFinanceIssueSnapshotQueryService,
  StripeConnectRequirementEntityRow,
} from "../interfaces/admin-routes.js";

export class AdminFinanceIssueSnapshotQueryService
  implements IAdminFinanceIssueSnapshotQueryService
{
  constructor(private readonly reader: IAdminFinanceIssueSnapshotReader) {}

  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot> {
    return this.reader.getFinanceIssueSnapshot();
  }

  listStripeConnectRequirementEntities(): Promise<StripeConnectRequirementEntityRow[]> {
    return this.reader.listStripeConnectRequirementEntities();
  }
}
