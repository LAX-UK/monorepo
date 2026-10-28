import { ConsignmentAgreementHttpApplicationService } from "../services/consignment-agreement/consignment-agreement-http-application.service.js";
import type { IConsignmentAgreementService } from "../services/consignment-agreement/consignment-agreement.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
} from "../services/interfaces/item-submission-apis.js";
import type { IConsignmentAfterSaleHttpApplicationService } from "../services/interfaces/submission-routes/consignment-after-sale-http.js";
import type { SubmissionRouteServices } from "../services/interfaces/submission-routes/index.js";
import type { ISubmissionDocumentPort } from "../services/interfaces/submission-routes/submission-document-port.js";
import { SubmissionAdminHttpApplicationService } from "../services/submission/submission-admin-http-application.service.js";
import { SubmissionDocumentHttpApplicationService } from "../services/submission/submission-document-http-application.service.js";
import { SubmissionSellerHttpApplicationService } from "../services/submission/submission-seller-http-application.service.js";

export type CreateSubmissionRouteServicesInput = {
  itemSubmissionSellerApi: IItemSubmissionSellerApi;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  submissionDocumentService: ISubmissionDocumentPort;
  consignmentAgreementService: IConsignmentAgreementService;
  consignmentAfterSaleHttp: IConsignmentAfterSaleHttpApplicationService;
};

export function createSubmissionRouteServices(
  input: CreateSubmissionRouteServicesInput,
): SubmissionRouteServices {
  return {
    sellerHttp: new SubmissionSellerHttpApplicationService(input.itemSubmissionSellerApi),
    adminHttp: new SubmissionAdminHttpApplicationService(input.itemSubmissionAdminApi),
    documentHttp: new SubmissionDocumentHttpApplicationService(
      input.itemSubmissionSellerApi,
      input.itemSubmissionAdminApi,
      input.submissionDocumentService,
    ),
    agreementHttp: new ConsignmentAgreementHttpApplicationService(
      input.consignmentAgreementService,
    ),
    afterSaleHttp: input.consignmentAfterSaleHttp,
  };
}
