import type { IRecordPeopleReader } from "@auction/persistence/interfaces";
import { ConsignmentAgreementHttpApplicationService } from "../services/consignment-agreement/consignment-agreement-http-application.service.js";
import type { IConsignmentAgreementService } from "../services/consignment-agreement/consignment-agreement.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
} from "../services/interfaces/item-submission-apis.js";
import type { IConsignmentAfterSaleHttpApplicationService } from "../services/interfaces/submission-routes/consignment-after-sale-http.js";
import type { SubmissionRouteServices } from "../services/interfaces/submission-routes/index.js";
import type { ISubmissionAccessGuard } from "../services/interfaces/submission-routes/submission-access.js";
import type { ISubmissionDocumentPort } from "../services/interfaces/submission-routes/submission-document-port.js";
import { SubmissionAdminHttpApplicationService } from "../services/submission/submission-admin-http-application.service.js";
import { SubmissionDocumentHttpApplicationService } from "../services/submission/submission-document-http-application.service.js";
import { SubmissionSellerHttpApplicationService } from "../services/submission/submission-seller-http-application.service.js";

export type CreateSubmissionRouteServicesInput = {
  itemSubmissionSellerApi: IItemSubmissionSellerApi;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  submissionDocumentService: ISubmissionDocumentPort;
  consignmentAgreementService: IConsignmentAgreementService;
  /** Decides which of an account's submissions the signed-in member may reach. */
  submissionAccess: ISubmissionAccessGuard;
  consignmentAfterSaleHttp: IConsignmentAfterSaleHttpApplicationService;
  /** Names the member who sent each consignment. */
  recordPeople: IRecordPeopleReader;
};

export function createSubmissionRouteServices(
  input: CreateSubmissionRouteServicesInput,
): SubmissionRouteServices {
  return {
    sellerHttp: new SubmissionSellerHttpApplicationService(
      input.itemSubmissionSellerApi,
      input.submissionAccess,
      input.recordPeople,
    ),
    adminHttp: new SubmissionAdminHttpApplicationService(input.itemSubmissionAdminApi),
    documentHttp: new SubmissionDocumentHttpApplicationService(
      input.itemSubmissionSellerApi,
      input.itemSubmissionAdminApi,
      input.submissionDocumentService,
      input.submissionAccess,
    ),
    agreementHttp: new ConsignmentAgreementHttpApplicationService(
      input.consignmentAgreementService,
      input.submissionAccess,
    ),
    afterSaleHttp: input.consignmentAfterSaleHttp,
  };
}
