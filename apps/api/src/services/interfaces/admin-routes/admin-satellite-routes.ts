import type {
  FailedJobBatchResult,
  FailedJobDetail,
  FailedJobDiscardReason,
  FailedJobList,
} from "@auction/types";
import type {
  AdminFailedJobsQuery,
  adminMarketingEventsReplayBodySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { AdminMarketingEventsService } from "../../admin/admin-marketing-events.service.js";
import type { AdminSavedViewService } from "../../admin/admin-saved-view.service.js";
import type { AdminTwoFactorResetService } from "../../admin/admin-two-factor-reset.service.js";
import type { StaffAccessAdminService } from "../../admin/staff-access-admin.service.js";
import type { DeliveryOpsApplicationService } from "../../delivery-ops.application.service.js";
import type { TwoFactorPolicyService } from "../../security/two-factor-policy.service.js";
import type { IStaffStepUpGuard } from "../../staff-step-up.service.js";
import type { LaxAdminRolesService } from "../../staff/lax-admin-roles.service.js";
import type { StaffRolesAdminService } from "../../staff/staff-roles-admin.service.js";
import type { IAtgAdminService } from "../atg-admin-service.js";
import type { IBuyerAgentAuthorisationService } from "../buyer-agent-authorisation-service.js";
import type { IIdempotencyStore } from "../idempotency-store.js";
import type { IOnsiteEventAdminService } from "../onsite-event-admin-service.js";
import type { IOnsiteEventStaffCheckInService } from "../onsite-event-staff-check-in-service.js";
import type { IStaffDeliveryQuoteService } from "../organisation-buying-service.js";
import type {
  ActorContext,
  IQueueInspector,
  IQueueMutator,
  JobDetail,
  JobSummary,
  QueueJobStatus,
  QueueOverview,
} from "../queue-inspector.js";

export type AdminMarketingEventsReplayBody = z.infer<typeof adminMarketingEventsReplayBodySchema>;

export interface IAdminJobQueuesApplicationService {
  list(): Promise<QueueOverview[]>;
  jobs(
    queueName: string,
    status: QueueJobStatus,
    page: { offset: number; limit: number },
  ): Promise<{ jobs: JobSummary[]; total: number }>;
  job(queueName: string, jobId: string): Promise<JobDetail | null>;
  retry(queueName: string, jobId: string, actor: ActorContext): Promise<void>;
  pause(queueName: string, actor: ActorContext): Promise<void>;
  resume(queueName: string, actor: ActorContext): Promise<void>;
  replayFromDlq(dlqJobId: string, actor: ActorContext, confirmIdempotency: boolean): Promise<void>;
}

/** Staff review of failed background jobs (see AdminFailedJobsService). */
export interface IAdminFailedJobsService {
  list(query: AdminFailedJobsQuery): Promise<FailedJobList>;
  detail(id: string): Promise<FailedJobDetail | null>;
  retry(
    ids: readonly string[],
    confirmRepeat: boolean,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult>;
  discard(
    ids: readonly string[],
    reason: FailedJobDiscardReason,
    note: string | undefined,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult>;
  restore(ids: readonly string[], actor: ActorContext): Promise<FailedJobBatchResult>;
}

export interface IAdminMarketingEventsApplicationService {
  replay(body: AdminMarketingEventsReplayBody): ReturnType<AdminMarketingEventsService["replay"]>;
  stats(days: number): ReturnType<AdminMarketingEventsService["stats"]>;
}

export type IAdminOnsiteEventsApplicationService = IOnsiteEventAdminService &
  IOnsiteEventStaffCheckInService;

export type AdminSatelliteRouteServices = {
  jobQueues: IAdminJobQueuesApplicationService;
  failedJobs: IAdminFailedJobsService;
  marketingEvents: IAdminMarketingEventsApplicationService;
  onsiteEvents: IAdminOnsiteEventsApplicationService;
  deliveryOps: DeliveryOpsApplicationService;
};

/** Third-party integrations staff operate from the admin (composed in the container root). */
export type AdminIntegrationRouteServices = {
  atg: IAtgAdminService;
  /** Staff manage an organisation's buyer-agent authorisations from its legal entity record. */
  buyerAgentAuthorisations: IBuyerAgentAuthorisationService;
  /** The saleroom team prices the courier quotes buyers ask for on won lots. */
  deliveryQuotes: IStaffDeliveryQuoteService;
};

/** Wired in the container root because the policy client lives outside the admin graph. */
export type AdminStaffSecurityRouteServices = {
  staffTwoFactorPolicy: Pick<TwoFactorPolicyService, "readStaffPolicy" | "setStaffPolicy">;
  twoFactorReset: Pick<AdminTwoFactorResetService, "reset">;
  staffAccess: Pick<StaffAccessAdminService, "summaries" | "detail" | "myTools">;
  /** A staff member's Bid roles, role changes and the access review. */
  staffRoles: Pick<StaffRolesAdminService, "overview" | "assign" | "remove" | "accessReview">;
  /** A person's LAX Admin roles on the same staff record, and changes to them. */
  laxAdminRoles: Pick<LaxAdminRolesService, "overview" | "assign" | "remove">;
  savedViews: Pick<AdminSavedViewService, "list" | "create" | "rename" | "reorder" | "remove">;
  /** Whether the signed-in staff member's Identity session is recent enough (step-up). */
  stepUp: IStaffStepUpGuard;
  /** Replays a staff money action when the same Idempotency-Key is sent again. */
  idempotencyStore: IIdempotencyStore;
};

export type { IQueueInspector, IQueueMutator };
