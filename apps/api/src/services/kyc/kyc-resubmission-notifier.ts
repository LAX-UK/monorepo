import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type { KycUserFeedback } from "../interfaces/kyc-service.js";

export class KycResubmissionNotifier {
  constructor(
    private readonly users: IUserRepository,
    private readonly email: IEmailService,
    private readonly notifications: INotificationWriteRepository,
    private readonly webOrigin: string,
  ) {}

  async notify(userId: string, feedback: KycUserFeedback): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.email) return;

    const verifyUrl = `${this.webOrigin.replace(/\/$/, "")}/dashboard/verify-identity`;
    const issueDetail = feedback.detail;

    await this.email.enqueue({
      template: "kyc-resubmission-required",
      to: user.email,
      userId,
      category: "transactional",
      vars: {
        userName: user.name,
        issueDetail,
        verifyUrl,
      },
    });

    await this.notifications.createMany([
      {
        userId,
        type: "kyc_resubmission_required",
        title: feedback.headline,
        message: issueDetail ?? "Please continue verification and resubmit the missing items.",
      },
    ]);
  }
}
