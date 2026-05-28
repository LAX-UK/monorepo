export type QueueJobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused";

export type QueueOverview = {
  name: string;
  description: string;
  criticality: string;
  paused: boolean;
  counts: Record<string, number>;
  heartbeatAgeMs: number | null;
  dlqDepth: number | null;
};

export type JobSummary = {
  id: string;
  name: string;
  status: QueueJobStatus;
  attemptsMade: number;
  timestamp: number;
  failedReason?: string | undefined;
  payloadPreview: string;
};

export type JobDetail = JobSummary & {
  payload: unknown;
  stacktrace: string[];
  opts: Record<string, unknown>;
};

export type ActorContext = {
  userId: string;
  staffRole: string | null;
  requestId?: string | undefined;
};

export interface IQueueInspector {
  list(): Promise<QueueOverview[]>;
  jobs(
    queueName: string,
    status: QueueJobStatus,
    page: { offset: number; limit: number },
  ): Promise<{ jobs: JobSummary[]; total: number }>;
  job(queueName: string, jobId: string): Promise<JobDetail | null>;
}

export interface IQueueMutator {
  retry(queueName: string, jobId: string, actor: ActorContext): Promise<void>;
  pause(queueName: string, actor: ActorContext): Promise<void>;
  resume(queueName: string, actor: ActorContext): Promise<void>;
  replayFromDlq(dlqJobId: string, actor: ActorContext, confirmIdempotency: boolean): Promise<void>;
}
