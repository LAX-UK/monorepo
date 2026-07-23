import type {
  IAdminJobQueuesApplicationService,
  IQueueInspector,
  IQueueMutator,
} from "../interfaces/admin-routes/admin-satellite-routes.js";

export class AdminJobQueuesApplicationService implements IAdminJobQueuesApplicationService {
  constructor(
    private readonly inspector: IQueueInspector,
    private readonly mutator: IQueueMutator,
  ) {}

  list(...args: Parameters<IQueueInspector["list"]>) {
    return this.inspector.list(...args);
  }

  jobs(...args: Parameters<IQueueInspector["jobs"]>) {
    return this.inspector.jobs(...args);
  }

  job(...args: Parameters<IQueueInspector["job"]>) {
    return this.inspector.job(...args);
  }

  retry(...args: Parameters<IQueueMutator["retry"]>) {
    return this.mutator.retry(...args);
  }

  pause(...args: Parameters<IQueueMutator["pause"]>) {
    return this.mutator.pause(...args);
  }

  resume(...args: Parameters<IQueueMutator["resume"]>) {
    return this.mutator.resume(...args);
  }

  replayFromDlq(...args: Parameters<IQueueMutator["replayFromDlq"]>) {
    return this.mutator.replayFromDlq(...args);
  }
}
