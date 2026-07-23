import type { adminMarketingEventsReplayBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { AdminMarketingEventsService } from "../../admin/admin-marketing-events.service.js";
import type { DeliveryOpsApplicationService } from "../../delivery-ops.application.service.js";
import type { IOnsiteEventAdminService } from "../onsite-event-admin-service.js";
import type { IOnsiteEventStaffCheckInService } from "../onsite-event-staff-check-in-service.js";
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

export interface IAdminMarketingEventsApplicationService {
  replay(body: AdminMarketingEventsReplayBody): ReturnType<AdminMarketingEventsService["replay"]>;
  stats(days: number): ReturnType<AdminMarketingEventsService["stats"]>;
}

export type IAdminOnsiteEventsApplicationService = IOnsiteEventAdminService &
  IOnsiteEventStaffCheckInService;

export type AdminSatelliteRouteServices = {
  jobQueues: IAdminJobQueuesApplicationService;
  marketingEvents: IAdminMarketingEventsApplicationService;
  onsiteEvents: IAdminOnsiteEventsApplicationService;
  deliveryOps: DeliveryOpsApplicationService;
};

export type { IQueueInspector, IQueueMutator };
