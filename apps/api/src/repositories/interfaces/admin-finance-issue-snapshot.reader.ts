import type {
  FinanceIssueSnapshot,
  StripeConnectRequirementEntityRow,
} from "../../services/interfaces/admin-routes.js";

export interface IAdminFinanceIssueSnapshotReader {
  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot>;
  listStripeConnectRequirementEntities(): Promise<StripeConnectRequirementEntityRow[]>;
}
