import type {
  ItemSubmission,
  SellerAfterSaleView,
  StaffAfterSaleView,
  UnsoldLotChoiceDecisionInput,
  UnsoldLotChoiceRequestInput,
} from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import { requireSubmissionsAccessHttp } from "../../lib/submission-http-auth.js";
import type { IConsignmentAfterSaleHttpApplicationService } from "../interfaces/submission-routes/consignment-after-sale-http.js";
import type { AgreementSellerContext } from "../interfaces/submission-routes/consignment-agreement-http.js";
import type { ISubmissionAccessGuard } from "../interfaces/submission-routes/submission-access.js";
import type {
  SubmissionHttpJson,
  SubmissionViewerContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import type { IConsignmentMoveService } from "./consignment-move.service.js";
import type { IConsignmentWithdrawalService } from "./consignment-withdrawal.service.js";
import type { ISellerIdentityReminderService } from "./seller-identity-reminder.service.js";
import type { IUnsoldLotChoiceService } from "./unsold-lot-choice.service.js";

export type ConsignmentAfterSaleHttpDeps = {
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  unsold: IUnsoldLotChoiceService;
  withdrawal: IConsignmentWithdrawalService;
  move: IConsignmentMoveService;
  reminder: ISellerIdentityReminderService;
  /** Hides submissions the member may not reach, exactly like ones in another account. */
  access: ISubmissionAccessGuard;
};

function respond<T>(result: Result<T, SubmissionError>): SubmissionHttpJson {
  if (result.isErr()) {
    const { message, status, code } = result.error;
    return { status, body: { error: message, ...(code ? { code } : {}) } };
  }
  return { status: 200, body: { data: result.value } };
}

const NOT_FOUND: SubmissionHttpJson = { status: 404, body: { error: "Not found" } };

/** Maps the after-sale use cases to HTTP responses; staff calls need submissions access. */
export class ConsignmentAfterSaleHttpApplicationService
  implements IConsignmentAfterSaleHttpApplicationService
{
  constructor(private readonly deps: ConsignmentAfterSaleHttpDeps) {}

  /** Whether the seller may not reach this submission (another member's, by sender scope). */
  private hidden(submissionId: string, seller: AgreementSellerContext): Promise<boolean> {
    return this.deps.access.hides(
      {
        legalEntityId: seller.legalEntityId,
        member: { userId: seller.userId, actor: seller.actor },
      },
      submissionId,
    );
  }

  async getForSeller(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<SubmissionHttpJson> {
    if (await this.hidden(submissionId, seller)) return NOT_FOUND;
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== seller.legalEntityId) return NOT_FOUND;
    const [stage, unsold, withdrawal] = await Promise.all([
      this.deps.unsold.stageOf(submission),
      this.deps.unsold.sellerView(submission, seller.actor),
      this.deps.withdrawal.sellerView(submission, seller),
    ]);
    const data: SellerAfterSaleView = { stage, unsold, withdrawal };
    return { status: 200, body: { data } };
  }

  async requestUnsoldChoice(
    submissionId: string,
    seller: AgreementSellerContext,
    input: UnsoldLotChoiceRequestInput,
  ): Promise<SubmissionHttpJson> {
    if (await this.hidden(submissionId, seller)) return NOT_FOUND;
    return respond(await this.deps.unsold.request(submissionId, seller, input));
  }

  async withdraw(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<SubmissionHttpJson> {
    if (await this.hidden(submissionId, seller)) return NOT_FOUND;
    return respond(await this.deps.withdrawal.withdraw(submissionId, seller));
  }

  async getForStaff(
    submissionId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission) return NOT_FOUND;
    const [unsold, withdrawal] = await Promise.all([
      this.deps.unsold.staffView(submission),
      this.deps.withdrawal.staffView(submission),
    ]);
    const data: StaffAfterSaleView = { unsold, withdrawal };
    return { status: 200, body: { data } };
  }

  async decideUnsoldChoice(
    submissionId: string,
    input: UnsoldLotChoiceDecisionInput,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.deps.unsold.decide(submissionId, viewer.userId, input));
  }

  async setRelistReserveFloor(
    submissionId: string,
    floor: string | null,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.deps.unsold.setReserveFloor(submissionId, floor));
  }

  async moveOptions(
    submissionId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.deps.move.options(submissionId));
  }

  async move(
    submissionId: string,
    legalEntityId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.deps.move.move(submissionId, viewer.userId, legalEntityId));
  }

  async remindSeller(
    submissionId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.deps.reminder.remind(submissionId, viewer.userId));
  }
}
