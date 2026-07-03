import type {
  FinanceIssueSnapshot,
  StripeConnectRequirementEntityRow,
} from "./admin-read-models.js";

export interface IAdminFinanceIssueSnapshotReader {
  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot>;
  listStripeConnectRequirementEntities(): Promise<StripeConnectRequirementEntityRow[]>;
}
