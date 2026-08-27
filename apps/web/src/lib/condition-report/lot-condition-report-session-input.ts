import type {
  ConditionReportRequestSnapshot,
  PublishedConditionReport,
} from "@/lib/condition-report/condition-report-types";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { SelfServiceActorKycStatus } from "@auction/domain";

export type LotConditionReportSessionInput = {
  lotId: string;
  loginNextPath: string;
  show: boolean;
  canParticipate: boolean;
  session: {
    isAuthenticated: boolean;
    emailVerified: boolean;
    email: string | null;
    kycStatus: SelfServiceActorKycStatus;
    kycFeedback: string | null;
    userId: string | null;
  } | null;
  published: PublishedConditionReport | null;
  buyerRequest: ConditionReportRequestSnapshot | null;
};

export type LotConditionReportViewModel = {
  session: LotConditionReportSessionInput;
  kycFeedbackDto: KycUserFeedbackDto | null;
};
