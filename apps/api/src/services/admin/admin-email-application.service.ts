import type { IEmailObservabilityRepository } from "@auction/persistence/interfaces";
import type { IAdminEmailApplicationService } from "../interfaces/admin-routes.js";

export class AdminEmailApplicationService implements IAdminEmailApplicationService {
  constructor(private readonly emailObservabilityRepository: IEmailObservabilityRepository) {}

  listOutbox(input: Parameters<IEmailObservabilityRepository["listOutbox"]>[0]) {
    return this.emailObservabilityRepository.listOutbox(input);
  }

  listEvents(input: Parameters<IEmailObservabilityRepository["listEvents"]>[0]) {
    return this.emailObservabilityRepository.listEvents(input);
  }

  listSuppressions(input: Parameters<IEmailObservabilityRepository["listSuppressions"]>[0]) {
    return this.emailObservabilityRepository.listSuppressions(input);
  }
}
