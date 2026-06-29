import { ok } from "neverthrow";
import { presentLotImages } from "../../lib/media-presenters.js";
import type { IAdminConditionReportsApplicationService } from "../interfaces/admin-routes.js";
import type {
  FulfillConditionReportInput,
  IConditionReportService,
} from "../interfaces/condition-report.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";

export class AdminConditionReportsApplicationService
  implements IAdminConditionReportsApplicationService
{
  constructor(
    private readonly conditionReports: IConditionReportService,
    private readonly mediaUrlResolver: MediaUrlResolver,
    private readonly mediaAssetEnricher: MediaAssetEnricher,
  ) {}

  listForAdmin(...args: Parameters<IConditionReportService["listForAdmin"]>) {
    return this.conditionReports.listForAdmin(...args);
  }

  markInProgress(...args: Parameters<IConditionReportService["markInProgress"]>) {
    return this.conditionReports.markInProgress(...args);
  }

  async fulfill(input: FulfillConditionReportInput) {
    const result = await this.conditionReports.fulfill(input);
    if (result.isErr()) {
      return result;
    }
    const data = await presentLotImages(
      this.mediaUrlResolver,
      result.value,
      this.mediaAssetEnricher,
    );
    return ok(data);
  }

  decline(...args: Parameters<IConditionReportService["decline"]>) {
    return this.conditionReports.decline(...args);
  }
}
